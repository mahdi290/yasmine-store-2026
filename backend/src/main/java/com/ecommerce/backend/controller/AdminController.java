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
    private final ShowcaseCardRepository showcaseCardRepository;
    private final CarouselSlideRepository carouselSlideRepository;
    private final DepartmentRepository departmentRepository;

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
            Map<String, Integer> sizeStocks,
            Boolean onSale,
            Integer discountPercent,
            String department
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
        Category category = null;
        if (req.categoryId() != null) {
            category = categoryRepository.findById(req.categoryId()).orElse(null);
        }
        if (category == null) {
            List<Category> allCategories = categoryRepository.findAll();
            if (!allCategories.isEmpty()) {
                category = allCategories.get(0);
            } else {
                return ResponseEntity.badRequest().body("Error: Category not found! Please create a category first.");
            }
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
                .onSale(req.onSale() != null ? req.onSale() : false)
                .discountPercent(req.discountPercent() != null ? req.discountPercent() : 0)
                .department(req.department() != null && !req.department().trim().isEmpty() ? req.department().toUpperCase() : "FEMME")
                .build();

        return ResponseEntity.ok(productRepository.save(product));
    }

    @PutMapping("/products/{id}")
    public ResponseEntity<?> updateProduct(@PathVariable Long id, @RequestBody ProductRequest req) {
        Product product = productRepository.findById(id).orElse(null);
        if (product == null) {
            return ResponseEntity.notFound().build();
        }

        Category category = null;
        if (req.categoryId() != null) {
            category = categoryRepository.findById(req.categoryId()).orElse(null);
        }
        if (category == null) {
            category = product.getCategory();
        }

        product.setName(req.name());
        product.setDescription(req.description());
        product.setPrice(req.price());
        product.setBrand(req.brand());
        product.setImageUrl(req.imageUrl());
        product.setCategory(category);
        product.setOnSale(req.onSale() != null ? req.onSale() : false);
        product.setDiscountPercent(req.discountPercent() != null ? req.discountPercent() : 0);
        if (req.department() != null && !req.department().trim().isEmpty()) {
            product.setDepartment(req.department().toUpperCase());
        }

        if (req.sizeStocks() != null) {
            product.getSizeStocks().clear();
            product.getSizeStocks().putAll(req.sizeStocks());
            product.setStock(req.sizeStocks().values().stream().mapToInt(Integer::intValue).sum());
        } else {
            product.setStock(req.stock() != null ? req.stock() : 0);
        }

        return ResponseEntity.ok(productRepository.save(product));
    }

    @PatchMapping("/products/{id}/solde")
    public ResponseEntity<?> toggleProductSolde(
            @PathVariable Long id,
            @RequestParam(required = false) Boolean onSale,
            @RequestParam(required = false) Integer discountPercent) {
        Product product = productRepository.findById(id).orElse(null);
        if (product == null) {
            return ResponseEntity.notFound().build();
        }
        if (onSale != null) {
            product.setOnSale(onSale);
        }
        if (discountPercent != null) {
            product.setDiscountPercent(discountPercent);
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
        if (category.getDepartment() == null || category.getDepartment().trim().isEmpty()) {
            category.setDepartment("Femme");
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
        if (req.getDepartment() != null) category.setDepartment(req.getDepartment());
        if (req.getIcon() != null) category.setIcon(req.getIcon());
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

    // 6. Showcase / Bento Grid Banner Management
    @GetMapping("/showcase")
    public ResponseEntity<List<ShowcaseCard>> getAdminShowcase() {
        return ResponseEntity.ok(showcaseCardRepository.findAllByOrderByDisplayOrderAsc());
    }

    @PutMapping("/showcase")
    public ResponseEntity<List<ShowcaseCard>> updateShowcase(@RequestBody List<ShowcaseCard> cards) {
        for (ShowcaseCard card : cards) {
            if (card.getCardKey() != null) {
                ShowcaseCard existing = showcaseCardRepository.findByCardKey(card.getCardKey()).orElse(null);
                if (existing != null) {
                    existing.setTitle(card.getTitle());
                    existing.setBadge(card.getBadge());
                    existing.setDescription(card.getDescription());
                    existing.setImageUrl(card.getImageUrl());
                    if (card.getCategoryQueryName() != null) existing.setCategoryQueryName(card.getCategoryQueryName());
                    showcaseCardRepository.save(existing);
                } else {
                    showcaseCardRepository.save(card);
                }
            }
        }
        return ResponseEntity.ok(showcaseCardRepository.findAllByOrderByDisplayOrderAsc());
    }

    @PutMapping("/showcase/{cardKey}")
    public ResponseEntity<?> updateSingleShowcaseCard(@PathVariable String cardKey, @RequestBody ShowcaseCard card) {
        ShowcaseCard existing = showcaseCardRepository.findByCardKey(cardKey).orElse(null);
        if (existing == null) {
            card.setCardKey(cardKey);
            return ResponseEntity.ok(showcaseCardRepository.save(card));
        }
        existing.setTitle(card.getTitle());
        existing.setBadge(card.getBadge());
        existing.setDescription(card.getDescription());
        existing.setImageUrl(card.getImageUrl());
        if (card.getCategoryQueryName() != null) existing.setCategoryQueryName(card.getCategoryQueryName());
        return ResponseEntity.ok(showcaseCardRepository.save(existing));
    }

    // 7. Carousel Hero Slides Management
    @GetMapping("/carousel")
    public ResponseEntity<List<CarouselSlide>> getAdminCarouselSlides() {
        return ResponseEntity.ok(carouselSlideRepository.findAllByOrderByDisplayOrderAsc());
    }

    @PostMapping("/carousel")
    public ResponseEntity<?> createCarouselSlide(@RequestBody CarouselSlide slide) {
        if (slide.getTitle() == null || slide.getTitle().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Le titre du slide est obligatoire."));
        }
        if (slide.getDisplayOrder() == null) {
            slide.setDisplayOrder((int) carouselSlideRepository.count() + 1);
        }
        if (slide.getActive() == null) {
            slide.setActive(true);
        }
        return ResponseEntity.ok(carouselSlideRepository.save(slide));
    }

    @PutMapping("/carousel/{id}")
    public ResponseEntity<?> updateCarouselSlide(@PathVariable Long id, @RequestBody CarouselSlide req) {
        CarouselSlide slide = carouselSlideRepository.findById(id).orElse(null);
        if (slide == null) {
            return ResponseEntity.notFound().build();
        }
        if (req.getTitle() != null) slide.setTitle(req.getTitle());
        if (req.getBadge() != null) slide.setBadge(req.getBadge());
        if (req.getSubtitle() != null) slide.setSubtitle(req.getSubtitle());
        if (req.getBtnText() != null) slide.setBtnText(req.getBtnText());
        if (req.getLink() != null) slide.setLink(req.getLink());
        if (req.getImageUrl() != null) slide.setImageUrl(req.getImageUrl());
        if (req.getDisplayOrder() != null) slide.setDisplayOrder(req.getDisplayOrder());
        if (req.getActive() != null) slide.setActive(req.getActive());

        return ResponseEntity.ok(carouselSlideRepository.save(slide));
    }

    @DeleteMapping("/carousel/{id}")
    public ResponseEntity<?> deleteCarouselSlide(@PathVariable Long id) {
        if (!carouselSlideRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        carouselSlideRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Slide supprimé avec succès."));
    }

    @PatchMapping("/carousel/{id}/toggle")
    public ResponseEntity<?> toggleCarouselSlideActive(@PathVariable Long id) {
        CarouselSlide slide = carouselSlideRepository.findById(id).orElse(null);
        if (slide == null) {
            return ResponseEntity.notFound().build();
        }
        slide.setActive(!Boolean.TRUE.equals(slide.getActive()));
        return ResponseEntity.ok(carouselSlideRepository.save(slide));
    }

    @PostMapping("/carousel/upload-image")
    public ResponseEntity<?> uploadCarouselImage(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Veuillez sélectionner un fichier image."));
        }
        try {
            String uploadDir = "uploads/carousel/";
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

            String fileUrl = "http://localhost:8081/uploads/carousel/" + newFilename;
            return ResponseEntity.ok(Map.of("imageUrl", fileUrl));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Erreur lors de l'enregistrement de l'image : " + e.getMessage()));
        }
    }

    // 8. Department / Rayon Management (FEMME, HOMME, etc.)
    @GetMapping("/departments")
    public ResponseEntity<List<Department>> getAdminDepartments() {
        return ResponseEntity.ok(departmentRepository.findAllByOrderByDisplayOrderAsc());
    }

    @PostMapping("/departments")
    public ResponseEntity<?> createDepartment(@RequestBody Department dept) {
        if (dept.getName() == null || dept.getName().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Le nom du rayon est obligatoire."));
        }
        dept.setName(dept.getName().trim().toUpperCase());
        if (dept.getCode() == null || dept.getCode().trim().isEmpty()) {
            dept.setCode(dept.getName().toLowerCase().replaceAll("[^a-z0-9]", ""));
        }
        if (dept.getDisplayOrder() == null) {
            dept.setDisplayOrder((int) departmentRepository.count() + 1);
        }
        if (dept.getActive() == null) {
            dept.setActive(true);
        }
        return ResponseEntity.ok(departmentRepository.save(dept));
    }

    @PutMapping("/departments/{id}")
    public ResponseEntity<?> updateDepartment(@PathVariable Long id, @RequestBody Department req) {
        Department dept = departmentRepository.findById(id).orElse(null);
        if (dept == null) {
            return ResponseEntity.notFound().build();
        }
        if (req.getName() != null) dept.setName(req.getName().trim().toUpperCase());
        if (req.getCode() != null) dept.setCode(req.getCode().trim().toLowerCase());
        if (req.getDescription() != null) dept.setDescription(req.getDescription());
        if (req.getSubcategories() != null) dept.setSubcategories(req.getSubcategories());
        if (req.getDisplayOrder() != null) dept.setDisplayOrder(req.getDisplayOrder());
        if (req.getActive() != null) dept.setActive(req.getActive());
        return ResponseEntity.ok(departmentRepository.save(dept));
    }

    @DeleteMapping("/departments/{id}")
    public ResponseEntity<?> deleteDepartment(@PathVariable Long id) {
        if (!departmentRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        departmentRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Rayon supprimé avec succès."));
    }

    @PatchMapping("/departments/{id}/toggle")
    public ResponseEntity<?> toggleDepartmentActive(@PathVariable Long id) {
        Department dept = departmentRepository.findById(id).orElse(null);
        if (dept == null) {
            return ResponseEntity.notFound().build();
        }
        dept.setActive(!Boolean.TRUE.equals(dept.getActive()));
        return ResponseEntity.ok(departmentRepository.save(dept));
    }
}
