package com.ecommerce.backend.controller;

import com.ecommerce.backend.model.*;
import com.ecommerce.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final UserRepository userRepository;

    // DTO records
    public record CategorySales(String categoryName, int salesCount, BigDecimal revenue) {}
    
    public record OrderResponse(
            Long id,
            String customerName,
            String customerEmail,
            String phone,
            String address,
            String city,
            BigDecimal totalPrice,
            String status,
            java.time.LocalDateTime createdAt
    ) {}

    private OrderResponse mapToOrderResponse(Order order) {
        String name = order.getCustomerName() != null ? order.getCustomerName() :
                (order.getUser() != null ? (order.getUser().getFirstname() + " " + order.getUser().getLastname()) : "Client Sans Compte");
        String email = order.getUser() != null ? order.getUser().getEmail() : "N/A";
        return new OrderResponse(
                order.getId(),
                name,
                email,
                order.getPhone() != null ? order.getPhone() : "N/A",
                order.getAddress() != null ? order.getAddress() : "N/A",
                order.getCity() != null ? order.getCity() : "N/A",
                order.getTotalPrice(),
                order.getStatus(),
                order.getCreatedAt()
        );
    }

    public record DashboardStats(
            BigDecimal totalRevenue,
            long totalOrders,
            long totalProducts,
            long totalUsers,
            List<OrderResponse> recentOrders,
            List<CategorySales> categorySales
    ) {}

    public record ProductRequest(
            String name,
            String description,
            BigDecimal price,
            Long categoryId,
            String brand,
            Integer stock,
            String imageUrl,
            Map<String, Integer> sizeStocks
    ) {}

    // 1. Dashboard Stats
    @GetMapping("/dashboard/stats")
    public ResponseEntity<DashboardStats> getDashboardStats() {
        List<Order> allOrders = orderRepository.findAll();
        
        // Calculate total revenue (exclude cancelled orders)
        BigDecimal totalRevenue = allOrders.stream()
                .filter(order -> !"CANCELLED".equalsIgnoreCase(order.getStatus()))
                .map(Order::getTotalPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long totalOrders = allOrders.size();
        long totalProducts = productRepository.count();
        long totalUsers = userRepository.count();

        // Get recent 5 orders
        List<OrderResponse> recentOrders = allOrders.stream()
                .sorted((o1, o2) -> o2.getCreatedAt().compareTo(o1.getCreatedAt()))
                .limit(5)
                .map(this::mapToOrderResponse)
                .toList();

        // Calculate category sales
        List<OrderItem> allItems = orderItemRepository.findAll();
        Map<String, CategorySales> salesMap = new HashMap<>();
        
        for (OrderItem item : allItems) {
            if (item.getOrder() != null && !"CANCELLED".equalsIgnoreCase(item.getOrder().getStatus())) {
                Product p = item.getProduct();
                if (p != null && p.getCategory() != null) {
                    String catName = p.getCategory().getName();
                    BigDecimal revenue = item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity()));
                    
                    CategorySales existing = salesMap.get(catName);
                    if (existing == null) {
                        salesMap.put(catName, new CategorySales(catName, item.getQuantity(), revenue));
                    } else {
                        salesMap.put(catName, new CategorySales(
                                catName,
                                existing.salesCount() + item.getQuantity(),
                                existing.revenue().add(revenue)
                        ));
                    }
                }
            }
        }
        
        List<CategorySales> categorySales = new ArrayList<>(salesMap.values());

        return ResponseEntity.ok(new DashboardStats(
                totalRevenue,
                totalOrders,
                totalProducts,
                totalUsers,
                recentOrders,
                categorySales
        ));
    }

    // 2. Product Management
    @PostMapping("/products/upload-image")
    public ResponseEntity<?> uploadProductImage(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Veuillez sélectionner un fichier image."));
        }
        try {
            String uploadDir = "uploads/products/";
            File dir = new File(uploadDir);
            if (!dir.exists()) {
                dir.mkdirs();
            }
            String originalFilename = file.getOriginalFilename();
            String extension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String newFilename = UUID.randomUUID().toString() + extension;
            Path filePath = Paths.get(uploadDir + newFilename);
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            String fileUrl = "http://localhost:8081/uploads/products/" + newFilename;
            return ResponseEntity.ok(Map.of("imageUrl", fileUrl));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Erreur lors de l'enregistrement de l'image : " + e.getMessage()));
        }
    }

    @GetMapping("/products")
    public ResponseEntity<List<Product>> getAllProducts() {
        return ResponseEntity.ok(productRepository.findAll());
    }

    @PostMapping("/products")
    public ResponseEntity<?> createProduct(@RequestBody ProductRequest req) {
        Category category = categoryRepository.findById(req.categoryId())
                .orElse(null);
        if (category == null) {
            return ResponseEntity.badRequest().body("Error: Category not found!");
        }

        Product product = Product.builder()
                .name(req.name())
                .description(req.description())
                .price(req.price())
                .brand(req.brand())
                .stock(req.stock() != null ? req.stock() : 0)
                .imageUrl(req.imageUrl())
                .category(category)
                .sizeStocks(req.sizeStocks() != null ? req.sizeStocks() : new HashMap<>())
                .build();

        return ResponseEntity.ok(productRepository.save(product));
    }

    @PutMapping("/products/{id}")
    public ResponseEntity<?> updateProduct(@PathVariable Long id, @RequestBody ProductRequest req) {
        Product product = productRepository.findById(id).orElse(null);
        if (product == null) {
            return ResponseEntity.notFound().build();
        }

        Category category = categoryRepository.findById(req.categoryId()).orElse(null);
        if (category == null) {
            return ResponseEntity.badRequest().body("Error: Category not found!");
        }

        product.setName(req.name());
        product.setDescription(req.description());
        product.setPrice(req.price());
        product.setBrand(req.brand());
        product.setImageUrl(req.imageUrl());
        product.setCategory(category);

        if (req.sizeStocks() != null) {
            product.getSizeStocks().clear();
            product.getSizeStocks().putAll(req.sizeStocks());
            product.setStock(req.sizeStocks().values().stream().mapToInt(Integer::intValue).sum());
        } else {
            product.setStock(req.stock() != null ? req.stock() : 0);
        }

        return ResponseEntity.ok(productRepository.save(product));
    }

    @DeleteMapping("/products/{id}")
    public ResponseEntity<?> deleteProduct(@PathVariable Long id) {
        if (!productRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        try {
            productRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Product deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot delete product because it has been ordered in past transactions. You can set its stock to 0 instead."));
        }
    }

    // 3. Category Management
    @PostMapping("/categories")
    public ResponseEntity<?> createCategory(@RequestBody Category category) {
        if (category.getName() == null || category.getName().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Error: Category name cannot be empty!");
        }
        return ResponseEntity.ok(categoryRepository.save(category));
    }

    @PutMapping("/categories/{id}")
    public ResponseEntity<?> updateCategory(@PathVariable Long id, @RequestBody Category req) {
        Category category = categoryRepository.findById(id).orElse(null);
        if (category == null) {
            return ResponseEntity.notFound().build();
        }
        category.setName(req.getName());
        return ResponseEntity.ok(categoryRepository.save(category));
    }

    @DeleteMapping("/categories/{id}")
    public ResponseEntity<?> deleteCategory(@PathVariable Long id) {
        if (!categoryRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        try {
            categoryRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Category deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot delete category because it contains active products. Delete or move the products first."));
        }
    }

    // 4. Order Management
    @GetMapping("/orders")
    public ResponseEntity<List<OrderResponse>> getAllOrders() {
        List<Order> orders = orderRepository.findAll();
        List<OrderResponse> response = orders.stream()
                .sorted((o1, o2) -> o2.getCreatedAt().compareTo(o1.getCreatedAt()))
                .map(this::mapToOrderResponse)
                .toList();
        return ResponseEntity.ok(response);
    }

    @PutMapping("/orders/{id}/status")
    public ResponseEntity<?> updateOrderStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Order order = orderRepository.findById(id).orElse(null);
        if (order == null) {
            return ResponseEntity.notFound().build();
        }
        
        String status = body.get("status");
        if (status == null || status.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Error: Status cannot be empty!");
        }

        order.setStatus(status.toUpperCase());
        return ResponseEntity.ok(orderRepository.save(order));
    }

    // 5. User Management
    @GetMapping("/users")
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userRepository.findAll());
    }

    @PutMapping("/users/{id}/role")
    public ResponseEntity<?> updateUserRole(@PathVariable Long id, @RequestBody Map<String, String> body) {
        User user = userRepository.findById(id).orElse(null);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        String role = body.get("role");
        if (role == null || role.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Error: Role cannot be empty!");
        }

        user.setRole(role.toUpperCase());
        return ResponseEntity.ok(userRepository.save(user));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        if (!userRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        try {
            userRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "User account deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot delete user because they have active shopping carts or past orders."));
        }
    }
}
