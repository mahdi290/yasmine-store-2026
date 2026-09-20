package com.ecommerce.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.HashMap;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "products")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "price", nullable = false)
    private BigDecimal price;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    @ToString.Exclude
    private Category category;

    @Column(name = "brand")
    private String brand;

    @Column(name = "stock", nullable = false)
    private Integer stock;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "product_size_stocks", joinColumns = @JoinColumn(name = "product_id"))
    @MapKeyColumn(name = "size")
    @Column(name = "stock")
    @Builder.Default
    private Map<String, Integer> sizeStocks = new HashMap<>();

    @Column(name = "image_url", columnDefinition = "LONGTEXT")
    private String imageUrl;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public void initializeSizeStocks() {
        if (sizeStocks == null) {
            sizeStocks = new HashMap<>();
        }
        if (sizeStocks.isEmpty() && stock != null) {
            int base = stock / 4;
            int rem = stock % 4;
            sizeStocks.put("S", base);
            sizeStocks.put("M", base);
            sizeStocks.put("L", base);
            sizeStocks.put("XL", base + rem);
        }
    }

    @PostLoad
    protected void onPostLoad() {
        initializeSizeStocks();
    }

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (stock == null) {
            stock = 0;
        }
        initializeSizeStocks();
    }

    @PreUpdate
    protected void onUpdate() {
        if (sizeStocks != null && !sizeStocks.isEmpty()) {
            stock = sizeStocks.values().stream().mapToInt(Integer::intValue).sum();
        }
    }
}
