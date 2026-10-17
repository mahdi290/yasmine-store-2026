package com.ecommerce.backend.service;

import com.ecommerce.backend.model.Order;
import com.ecommerce.backend.model.OrderItem;
import com.ecommerce.backend.model.Product;
import com.ecommerce.backend.model.ProductVariant;
import com.ecommerce.backend.repository.OrderItemRepository;
import com.ecommerce.backend.repository.OrderRepository;
import com.ecommerce.backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Modification / suppression de commandes depuis l'admin, avec un stock toujours cohérent :
 *  - une commande non annulée "réserve" son stock ;
 *  - l'annuler ou la supprimer remet le stock ; la réactiver le reprend ;
 *  - modifier ses articles remet l'ancien stock puis réserve le nouveau.
 * Toute erreur (stock insuffisant, données invalides) annule l'ensemble de la transaction.
 */
@Service
@RequiredArgsConstructor
public class AdminOrderService {

    public static final List<String> STATUSES = List.of("PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED");
    private static final String CANCELLED = "CANCELLED";
    private static final Set<String> SIZES = Set.of("S", "M", "L", "XL");
    private static final Pattern PHONE = Pattern.compile("^[+0-9 ().-]{6,20}$");
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductRepository productRepository;
    private final PricingService pricingService;

    /** Erreur de validation métier, renvoyée telle quelle (en français) avec un code 400 / 404. */
    public static class OrderUpdateException extends RuntimeException {
        private final int status;

        public OrderUpdateException(int status, String message) {
            super(message);
            this.status = status;
        }

        public int getStatus() {
            return status;
        }
    }

    public record ItemRequest(Long productId, Long variantId, String size, Integer quantity) {}

    public record UpdateRequest(String status, String customerName, String phone, String email,
                                String address, String city, List<ItemRequest> items) {}

    // ------------------------------------------------------------------ statut seul

    @Transactional
    public Order changeStatus(Long orderId, String rawStatus) {
        Order order = find(orderId);
        String status = validateStatus(rawStatus);
        boolean wasReserved = !CANCELLED.equals(order.getStatus());
        boolean willReserve = !CANCELLED.equals(status);

        if (wasReserved != willReserve) {
            List<OrderItem> items = orderItemRepository.findByOrderId(orderId);
            if (willReserve) {
                // Commande réactivée : le stock doit être disponible à nouveau
                for (OrderItem item : items) {
                    reserve(item.getProduct(), variantOf(item), item.getSize(), item.getQuantity());
                }
            } else {
                items.forEach(this::release);
            }
        }
        order.setStatus(status);
        return orderRepository.save(order);
    }

    // ------------------------------------------------------------------ modification complète

    @Transactional
    public Order update(Long orderId, UpdateRequest req) {
        Order order = find(orderId);
        if (req == null) {
            throw new OrderUpdateException(400, "Requête vide.");
        }
        String status = validateStatus(req.status() != null ? req.status() : order.getStatus());
        String name = required(req.customerName(), "Le nom du client est obligatoire.", 120);
        String phone = required(req.phone(), "Le téléphone est obligatoire.", 20);
        if (!PHONE.matcher(phone).matches()) {
            throw new OrderUpdateException(400, "Numéro de téléphone invalide.");
        }
        String address = required(req.address(), "L'adresse est obligatoire.", 255);
        String city = optional(req.city(), 120);
        String email = optional(req.email(), 255);
        if (email != null && !EMAIL.matcher(email).matches()) {
            throw new OrderUpdateException(400, "Adresse email invalide.");
        }
        if (req.items() == null || req.items().isEmpty()) {
            throw new OrderUpdateException(400, "La commande doit contenir au moins un article.");
        }

        // 1. Remettre en stock les anciens articles (si la commande réservait du stock)
        List<OrderItem> oldItems = orderItemRepository.findByOrderId(orderId);
        if (!CANCELLED.equals(order.getStatus())) {
            oldItems.forEach(this::release);
        }

        // Prix d'origine conservés pour les articles déjà présents (même produit, couleur et taille)
        Map<String, BigDecimal> originalPrices = new HashMap<>();
        for (OrderItem old : oldItems) {
            if (old.getProduct() != null) {
                originalPrices.putIfAbsent(key(old.getProduct().getId(), old.getVariantId(), old.getSize()), old.getPrice());
            }
        }

        // 2. Construire et valider les nouvelles lignes
        List<OrderItem> newItems = new ArrayList<>();
        for (ItemRequest itemReq : req.items()) {
            if (itemReq == null || itemReq.productId() == null) {
                throw new OrderUpdateException(400, "Chaque article doit avoir un produit.");
            }
            Product product = productRepository.findById(itemReq.productId())
                    .orElseThrow(() -> new OrderUpdateException(400, "Produit introuvable (ID " + itemReq.productId() + ")."));
            int qty = itemReq.quantity() != null ? itemReq.quantity() : 0;
            if (qty < 1 || qty > 100) {
                throw new OrderUpdateException(400, "Quantité invalide pour " + product.getName() + " (entre 1 et 100).");
            }
            String size = itemReq.size() != null ? itemReq.size().trim().toUpperCase() : "";
            if (!SIZES.contains(size)) {
                throw new OrderUpdateException(400, "Taille invalide pour " + product.getName() + ".");
            }
            ProductVariant variant = null;
            if (product.hasVariants()) {
                variant = product.findVariant(itemReq.variantId());
                if (variant == null) {
                    throw new OrderUpdateException(400, "Veuillez choisir une couleur pour " + product.getName() + ".");
                }
            }

            OrderItem item = OrderItem.builder()
                    .order(order)
                    .product(product)
                    .quantity(qty)
                    .size(size)
                    .color(variant != null ? variant.getColorName() : "Default")
                    .variantId(variant != null ? variant.getId() : null)
                    .colorHex(variant != null ? variant.getColorHex() : null)
                    .imageUrl(variant != null && variant.getImageUrl() != null ? variant.getImageUrl() : product.getImageUrl())
                    .price(originalPrices.getOrDefault(key(product.getId(), variant != null ? variant.getId() : null, size),
                            PricingService.effectivePrice(product)))
                    .build();
            newItems.add(item);
        }

        // 3. Réserver le stock des nouveaux articles (sauf commande annulée)
        if (!CANCELLED.equals(status)) {
            for (OrderItem item : newItems) {
                reserve(item.getProduct(), variantOf(item), item.getSize(), item.getQuantity());
            }
        }

        // 4. Recalcul du total et de la remise par quantité (règles actives)
        PricingService.Quote quote = pricingService.quote(newItems.stream()
                .map(i -> new PricingService.Line(i.getProduct(), i.getQuantity(), i.getPrice()))
                .toList());
        for (int i = 0; i < newItems.size(); i++) {
            PricingService.LineResult r = quote.lines().get(i);
            newItems.get(i).setPrice(r.unitPrice());
            newItems.get(i).setDiscountPercent(r.discountPercent());
            newItems.get(i).setDiscountAmount(r.discountAmount());
        }

        orderItemRepository.deleteAll(oldItems);
        orderItemRepository.flush();
        orderItemRepository.saveAll(newItems);

        order.setStatus(status);
        order.setCustomerName(name);
        order.setPhone(phone);
        order.setEmail(email);
        order.setAddress(address);
        order.setCity(city);
        order.setSubtotal(quote.subtotal());
        order.setDiscountAmount(quote.discountAmount());
        order.setDiscountDetails(quote.describe());
        order.setTotalPrice(quote.total());
        return orderRepository.save(order);
    }

    // ------------------------------------------------------------------ suppression

    @Transactional
    public void delete(Long orderId) {
        Order order = find(orderId);
        List<OrderItem> items = orderItemRepository.findByOrderId(orderId);
        if (!CANCELLED.equals(order.getStatus())) {
            items.forEach(this::release);
        }
        orderItemRepository.deleteAll(items);
        orderRepository.delete(order);
    }

    // ------------------------------------------------------------------ outils

    private Order find(Long orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderUpdateException(404, "Commande #" + orderId + " introuvable."));
    }

    private String validateStatus(String raw) {
        String status = raw != null ? raw.trim().toUpperCase() : "";
        if (!STATUSES.contains(status)) {
            throw new OrderUpdateException(400, "Statut invalide. Valeurs possibles : en attente, confirmée, expédiée, livrée, annulée.");
        }
        return status;
    }

    private static String required(String value, String message, int maxLength) {
        if (value == null || value.trim().isEmpty()) {
            throw new OrderUpdateException(400, message);
        }
        String v = value.trim();
        if (v.length() > maxLength) {
            throw new OrderUpdateException(400, "Valeur trop longue (" + maxLength + " caractères maximum).");
        }
        return v;
    }

    private static String optional(String value, int maxLength) {
        if (value == null || value.trim().isEmpty()) return null;
        String v = value.trim();
        if (v.length() > maxLength) {
            throw new OrderUpdateException(400, "Valeur trop longue (" + maxLength + " caractères maximum).");
        }
        return v;
    }

    private static String key(Long productId, Long variantId, String size) {
        return productId + "|" + variantId + "|" + (size != null ? size.toUpperCase() : "");
    }

    private ProductVariant variantOf(OrderItem item) {
        return item.getProduct() != null ? item.getProduct().findVariant(item.getVariantId()) : null;
    }

    /** Retire du stock ; erreur si le stock disponible est insuffisant. */
    private void reserve(Product product, ProductVariant variant, String size, int qty) {
        if (product == null) return;
        if (product.hasVariants() && variant == null) {
            throw new OrderUpdateException(400, "La couleur commandée pour " + product.getName() + " n'existe plus : choisissez une autre couleur.");
        }
        int available = product.getAvailableStock(variant, size);
        if (available < qty) {
            String what = variant != null ? variant.getColorName() + ", taille " + size : "taille " + size;
            throw new OrderUpdateException(400, "Stock insuffisant pour " + product.getName() + " (" + what + ") : "
                    + available + " disponible(s), " + qty + " demandé(s).");
        }
        product.adjustStock(variant, size, -qty);
        productRepository.save(product);
    }

    /** Remet en stock un article de commande (si sa couleur existe encore). */
    private void release(OrderItem item) {
        Product product = item.getProduct();
        if (product == null || item.getQuantity() == null) return;
        String size = item.getSize() != null ? item.getSize().trim().toUpperCase() : "M";
        ProductVariant variant = variantOf(item);
        if (product.hasVariants() && variant == null) {
            // Couleur supprimée depuis la commande : impossible de savoir où remettre le stock
            return;
        }
        product.adjustStock(variant, size, item.getQuantity());
        productRepository.save(product);
    }
}
