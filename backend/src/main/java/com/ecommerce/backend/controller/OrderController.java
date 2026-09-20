package com.ecommerce.backend.controller;

import com.ecommerce.backend.model.CartItem;
import com.ecommerce.backend.model.Order;
import com.ecommerce.backend.model.OrderItem;
import com.ecommerce.backend.model.Product;
import com.ecommerce.backend.model.User;
import com.ecommerce.backend.repository.CartItemRepository;
import com.ecommerce.backend.repository.OrderItemRepository;
import com.ecommerce.backend.repository.OrderRepository;
import com.ecommerce.backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
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

    @PostMapping
    @Transactional
    public ResponseEntity<?> placeOrder(@AuthenticationPrincipal User user) {
        List<CartItem> cartItems = cartItemRepository.findByUserId(user.getId());
        if (cartItems.isEmpty()) {
            return ResponseEntity.badRequest().body("Error: Cart is empty!");
        }

        BigDecimal totalPrice = BigDecimal.ZERO;
        List<OrderItem> orderItemsToSave = new ArrayList<>();

        for (CartItem cartItem : cartItems) {
            Product product = cartItem.getProduct();
            String size = cartItem.getSize() != null && !cartItem.getSize().trim().isEmpty() ? cartItem.getSize().trim() : "M";

            // Initialize size stocks in case they are not persisted yet
            product.initializeSizeStocks();

            Integer sizeStock = product.getSizeStocks().getOrDefault(size, 0);
            if (sizeStock < cartItem.getQuantity()) {
                return ResponseEntity.badRequest().body("Error: Insufficient stock for size " + size + " of product " + product.getName());
            }

            // Subtract stock from sizeStocks
            product.getSizeStocks().put(size, sizeStock - cartItem.getQuantity());
            // Recalculate global stock
            product.setStock(product.getSizeStocks().values().stream().mapToInt(Integer::intValue).sum());

            productRepository.save(product);

            // Compute total
            BigDecimal itemTotal = product.getPrice().multiply(BigDecimal.valueOf(cartItem.getQuantity()));
            totalPrice = totalPrice.add(itemTotal);

            // Create OrderItem details
            OrderItem orderItem = OrderItem.builder()
                    .product(product)
                    .quantity(cartItem.getQuantity())
                    .price(product.getPrice()) // price at order time
                    .size(cartItem.getSize() != null ? cartItem.getSize() : "M")
                    .color("Default")
                    .build();

            orderItemsToSave.add(orderItem);
        }

        // Save Order
        Order order = Order.builder()
                .user(user)
                .totalPrice(totalPrice)
                .status("PENDING")
                .build();
        orderRepository.save(order);

        // Associate items with the saved order and save them
        for (OrderItem item : orderItemsToSave) {
            item.setOrder(order);
            orderItemRepository.save(item);
        }

        // Clear cart
        cartItemRepository.deleteByUserId(user.getId());

        // Construct response with order and items
        Map<String, Object> response = new HashMap<>();
        response.put("order", order);
        response.put("items", orderItemsToSave);

        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getOrderHistory(@AuthenticationPrincipal User user) {
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
