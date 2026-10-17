package com.ecommerce.backend.controller;

import com.ecommerce.backend.dto.CartRequest;
import com.ecommerce.backend.model.CartItem;
import com.ecommerce.backend.model.Product;
import com.ecommerce.backend.model.User;
import com.ecommerce.backend.repository.CartItemRepository;
import com.ecommerce.backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartItemRepository cartItemRepository;
    private final ProductRepository productRepository;

    @GetMapping
    public ResponseEntity<List<CartItem>> getCart(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(cartItemRepository.findByUserId(user.getId()));
    }

    @PostMapping
    public ResponseEntity<?> addToCart(@AuthenticationPrincipal User user, @RequestBody CartRequest request) {
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new RuntimeException("Product not found"));

        String size = request.getSize() != null && !request.getSize().trim().isEmpty() ? request.getSize().trim() : "M";

        // Même produit mais couleur différente = ligne de panier distincte
        Optional<CartItem> existingItemOpt = request.getVariantId() != null
                ? cartItemRepository.findByUserIdAndProductIdAndSizeAndVariantId(user.getId(), request.getProductId(), size, request.getVariantId())
                : cartItemRepository.findByUserIdAndProductIdAndSize(user.getId(), request.getProductId(), size)
                        .filter(item -> item.getVariantId() == null);

        CartItem cartItem;
        if (existingItemOpt.isPresent()) {
            cartItem = existingItemOpt.get();
            cartItem.setQuantity(cartItem.getQuantity() + request.getQuantity());
        } else {
            cartItem = CartItem.builder()
                    .user(user)
                    .product(product)
                    .quantity(request.getQuantity())
                    .size(size)
                    .variantId(request.getVariantId())
                    .build();
        }

        cartItemRepository.save(cartItem);
        return ResponseEntity.ok(cartItem);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateQuantity(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @RequestParam Integer quantity
    ) {
        CartItem cartItem = cartItemRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cart item not found"));

        if (!cartItem.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body("Error: Unauthorized action!");
        }

        if (quantity <= 0) {
            cartItemRepository.delete(cartItem);
            return ResponseEntity.ok("Item removed from cart");
        }

        cartItem.setQuantity(quantity);
        cartItemRepository.save(cartItem);
        return ResponseEntity.ok(cartItem);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> removeFromCart(@AuthenticationPrincipal User user, @PathVariable Long id) {
        CartItem cartItem = cartItemRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cart item not found"));

        if (!cartItem.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body("Error: Unauthorized action!");
        }

        cartItemRepository.delete(cartItem);
        return ResponseEntity.ok("Item removed from cart");
    }

    @DeleteMapping
    @Transactional
    public ResponseEntity<?> clearCart(@AuthenticationPrincipal User user) {
        cartItemRepository.deleteByUserId(user.getId());
        return ResponseEntity.ok("Cart cleared");
    }
}
