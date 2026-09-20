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

    public record OrderItemRequest(Long productId, Integer quantity, String size) {}
    public record GuestOrderRequest(String customerName, String phone, String address, String city, List<OrderItemRequest> items) {}

    @PostMapping
    @Transactional
    public ResponseEntity<?> placeOrder(
            @RequestBody(required = false) GuestOrderRequest request,
            @AuthenticationPrincipal User user) {

        List<OrderItem> orderItemsToSave = new ArrayList<>();
        BigDecimal totalPrice = BigDecimal.ZERO;

        String customerName = null;
        String phone = null;
        String address = null;
        String city = null;

        if (request != null && request.items() != null && !request.items().isEmpty()) {
            // Guest Checkout flow
            customerName = request.customerName();
            phone = request.phone();
            address = request.address();
            city = request.city();

            for (OrderItemRequest itemReq : request.items()) {
                if (itemReq.productId() == null) continue;
                Product product = productRepository.findById(itemReq.productId()).orElse(null);
                if (product == null) {
                    return ResponseEntity.badRequest().body("Error: Product ID " + itemReq.productId() + " not found!");
                }

                int qty = itemReq.quantity() != null && itemReq.quantity() > 0 ? itemReq.quantity() : 1;
                String size = itemReq.size() != null && !itemReq.size().trim().isEmpty() ? itemReq.size().trim() : "M";

                product.initializeSizeStocks();
                Integer sizeStock = product.getSizeStocks().getOrDefault(size, 0);
                if (sizeStock < qty) {
                    return ResponseEntity.badRequest().body("Error: Insufficient stock for size " + size + " of product " + product.getName());
                }

                // Subtract stock
                product.getSizeStocks().put(size, sizeStock - qty);
                product.setStock(product.getSizeStocks().values().stream().mapToInt(Integer::intValue).sum());
                productRepository.save(product);

                BigDecimal itemTotal = product.getPrice().multiply(BigDecimal.valueOf(qty));
                totalPrice = totalPrice.add(itemTotal);

                OrderItem orderItem = OrderItem.builder()
                        .product(product)
                        .quantity(qty)
                        .price(product.getPrice())
                        .size(size)
                        .color("Default")
                        .build();

                orderItemsToSave.add(orderItem);
            }
        } else if (user != null) {
            // Fallback for logged in user cart
            List<CartItem> cartItems = cartItemRepository.findByUserId(user.getId());
            if (cartItems.isEmpty()) {
                return ResponseEntity.badRequest().body("Error: Cart is empty!");
            }
            customerName = user.getFirstname() + " " + user.getLastname();

            for (CartItem cartItem : cartItems) {
                Product product = cartItem.getProduct();
                String size = cartItem.getSize() != null && !cartItem.getSize().trim().isEmpty() ? cartItem.getSize().trim() : "M";

                product.initializeSizeStocks();
                Integer sizeStock = product.getSizeStocks().getOrDefault(size, 0);
                if (sizeStock < cartItem.getQuantity()) {
                    return ResponseEntity.badRequest().body("Error: Insufficient stock for size " + size + " of product " + product.getName());
                }

                product.getSizeStocks().put(size, sizeStock - cartItem.getQuantity());
                product.setStock(product.getSizeStocks().values().stream().mapToInt(Integer::intValue).sum());
                productRepository.save(product);

                BigDecimal itemTotal = product.getPrice().multiply(BigDecimal.valueOf(cartItem.getQuantity()));
                totalPrice = totalPrice.add(itemTotal);

                OrderItem orderItem = OrderItem.builder()
                        .product(product)
                        .quantity(cartItem.getQuantity())
                        .price(product.getPrice())
                        .size(size)
                        .color("Default")
                        .build();

                orderItemsToSave.add(orderItem);
            }
            cartItemRepository.deleteByUserId(user.getId());
        } else {
            return ResponseEntity.badRequest().body("Error: Order items or customer details are required!");
        }

        // Save Order
        Order order = Order.builder()
                .user(user)
                .customerName(customerName)
                .phone(phone)
                .address(address)
                .city(city)
                .totalPrice(totalPrice)
                .status("PENDING")
                .build();
        orderRepository.save(order);

        for (OrderItem item : orderItemsToSave) {
            item.setOrder(order);
            orderItemRepository.save(item);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("order", order);
        response.put("items", orderItemsToSave);

        return ResponseEntity.ok(response);
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
