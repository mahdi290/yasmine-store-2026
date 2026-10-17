package com.ecommerce.backend.controller;

import com.ecommerce.backend.model.CartItem;
import com.ecommerce.backend.model.Order;
import com.ecommerce.backend.model.OrderItem;
import com.ecommerce.backend.model.Product;
import com.ecommerce.backend.model.ProductVariant;
import com.ecommerce.backend.model.User;
import com.ecommerce.backend.repository.CartItemRepository;
import com.ecommerce.backend.repository.OrderItemRepository;
import com.ecommerce.backend.repository.OrderRepository;
import com.ecommerce.backend.repository.ProductRepository;
import com.ecommerce.backend.service.EmailService;
import com.ecommerce.backend.service.PricingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final CartItemRepository cartItemRepository;
    private final ProductRepository productRepository;
    private final EmailService emailService;
    private final PricingService pricingService;

    public record OrderItemRequest(Long productId, Integer quantity, String size, Long variantId) {}
    public record GuestOrderRequest(String customerName, String phone, String email, String address, String city, List<OrderItemRequest> items) {}

    /** Résultat de la préparation d'une ligne : soit une erreur, soit la ligne prête (stock déjà réservé). */
    private record PreparedLine(OrderItem item, String error) {}

    /**
     * Vérifie le stock (par couleur et taille si le produit est multicolore), le décrémente
     * et construit la ligne de commande avec un instantané de la couleur choisie.
     */
    private PreparedLine prepareLine(Product product, Long variantId, String rawSize, int qty) {
        String size = rawSize != null && !rawSize.trim().isEmpty() ? rawSize.trim().toUpperCase() : "M";

        ProductVariant variant = null;
        if (product.hasVariants()) {
            variant = product.findVariant(variantId);
            if (variant == null && product.getVariants().size() == 1) {
                variant = product.getVariants().get(0);
            }
            if (variant == null) {
                return new PreparedLine(null, "Veuillez choisir une couleur pour le produit " + product.getName() + ".");
            }
        }

        int available = product.getAvailableStock(variant, size);
        if (available < qty) {
            String what = variant != null ? "la couleur " + variant.getColorName() + ", taille " + size : "la taille " + size;
            return new PreparedLine(null, "Stock insuffisant pour " + what + " du produit " + product.getName()
                    + " (disponible : " + available + ").");
        }

        product.adjustStock(variant, size, -qty);
        productRepository.save(product);

        OrderItem orderItem = OrderItem.builder()
                .product(product)
                .quantity(qty)
                .price(PricingService.effectivePrice(product))
                .size(size)
                .color(variant != null ? variant.getColorName() : "Default")
                .variantId(variant != null ? variant.getId() : null)
                .colorHex(variant != null ? variant.getColorHex() : null)
                .imageUrl(variant != null && variant.getImageUrl() != null ? variant.getImageUrl() : product.getImageUrl())
                .build();
        return new PreparedLine(orderItem, null);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> placeOrder(
            @RequestBody(required = false) GuestOrderRequest request,
            @AuthenticationPrincipal User user) {

        List<OrderItem> orderItemsToSave = new ArrayList<>();

        String customerName = null;
        String phone = null;
        String email = null;
        String address = null;
        String city = null;

        if (request != null && request.items() != null && !request.items().isEmpty()) {
            // Guest Checkout flow
            customerName = request.customerName();
            phone = request.phone();
            email = request.email();
            address = request.address();
            city = request.city();

            for (OrderItemRequest itemReq : request.items()) {
                if (itemReq.productId() == null) continue;
                Product product = productRepository.findById(itemReq.productId()).orElse(null);
                if (product == null) {
                    return rollback("Produit introuvable (ID " + itemReq.productId() + ").");
                }

                int qty = itemReq.quantity() != null && itemReq.quantity() > 0 ? itemReq.quantity() : 1;
                PreparedLine line = prepareLine(product, itemReq.variantId(), itemReq.size(), qty);
                if (line.error() != null) {
                    return rollback(line.error());
                }
                orderItemsToSave.add(line.item());
            }
        } else if (user != null) {
            // Fallback for logged in user cart
            List<CartItem> cartItems = cartItemRepository.findByUserId(user.getId());
            if (cartItems.isEmpty()) {
                return ResponseEntity.badRequest().body("Error: Cart is empty!");
            }
            customerName = user.getFirstname() + " " + user.getLastname();
            email = user.getEmail();

            for (CartItem cartItem : cartItems) {
                PreparedLine line = prepareLine(cartItem.getProduct(), cartItem.getVariantId(), cartItem.getSize(), cartItem.getQuantity());
                if (line.error() != null) {
                    return rollback(line.error());
                }
                orderItemsToSave.add(line.item());
            }
            cartItemRepository.deleteByUserId(user.getId());
        } else {
            return ResponseEntity.badRequest().body("Error: Order items or customer details are required!");
        }

        if (orderItemsToSave.isEmpty()) {
            return ResponseEntity.badRequest().body("Votre panier est vide.");
        }

        // Prix et remise par quantité recalculés ici, jamais repris du navigateur
        PricingService.Quote quote = pricingService.quote(orderItemsToSave.stream()
                .map(i -> new PricingService.Line(i.getProduct(), i.getQuantity(), i.getPrice()))
                .toList());
        for (int i = 0; i < orderItemsToSave.size(); i++) {
            PricingService.LineResult r = quote.lines().get(i);
            OrderItem item = orderItemsToSave.get(i);
            item.setPrice(r.unitPrice());
            item.setDiscountPercent(r.discountPercent());
            item.setDiscountAmount(r.discountAmount());
        }

        // Save Order
        Order order = Order.builder()
                .user(user)
                .customerName(customerName)
                .phone(phone)
                .email(email)
                .address(address)
                .city(city)
                .subtotal(quote.subtotal())
                .discountAmount(quote.discountAmount())
                .discountDetails(quote.describe())
                .totalPrice(quote.total())
                .status("PENDING")
                .build();
        orderRepository.save(order);

        for (OrderItem item : orderItemsToSave) {
            item.setOrder(order);
            orderItemRepository.save(item);
        }

        // Send email notification to yasminestoresf@gmail.com and customer
        emailService.sendOrderNotificationAsync(order, orderItemsToSave);

        Map<String, Object> response = new HashMap<>();
        response.put("order", order);
        response.put("items", orderItemsToSave);

        return ResponseEntity.ok(response);
    }

    // Annule les décréments de stock déjà effectués si une ligne est refusée
    private ResponseEntity<?> rollback(String message) {
        TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
        return ResponseEntity.badRequest().body(message);
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getOrderHistory(@AuthenticationPrincipal User user) {
        if (user == null) {
            return ResponseEntity.ok(List.of());
        }
        List<Order> orders = orderRepository.findByUserId(user.getId());
        List<Map<String, Object>> response = new ArrayList<>();

        for (Order order : orders) {
            List<OrderItem> items = orderItemRepository.findByOrderId(order.getId());
            Map<String, Object> orderMap = new HashMap<>();
            orderMap.put("order", order);
            orderMap.put("items", items);
            response.add(orderMap);
        }

        return ResponseEntity.ok(response);
    }
}
