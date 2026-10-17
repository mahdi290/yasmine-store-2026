package com.ecommerce.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Objects;

import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "products")
@Data
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
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

    // Variantes couleur (vide pour les anciens produits sans couleur : rétrocompatibles)
    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @Fetch(FetchMode.SUBSELECT)
    @OrderColumn(name = "position")
    @Builder.Default
    @ToString.Exclude
    private List<ProductVariant> variants = new ArrayList<>();

    @Column(name = "on_sale")
    @Builder.Default
    private Boolean onSale = false;

    @Column(name = "discount_percent")
    @Builder.Default
    private Integer discountPercent = 0;

    @Column(name = "department")
    @Builder.Default
    private String department = "FEMME";

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public BigDecimal getSalePrice() {
        if (Boolean.TRUE.equals(onSale) && discountPercent != null && discountPercent > 0 && price != null) {
            BigDecimal factor = BigDecimal.valueOf(100 - discountPercent);
            return price.multiply(factor).divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
        }
        return price;
    }

    public boolean hasVariants() {
        return variants != null && !variants.isEmpty();
    }

    public ProductVariant findVariant(Long variantId) {
        if (variantId == null || variants == null) return null;
        return variants.stream().filter(v -> Objects.equals(v.getId(), variantId)).findFirst().orElse(null);
    }

    /**
     * Pour un produit multicolore, le stock par taille du produit est la somme
     * des stocks de ses couleurs (les listes, filtres "Rupture", etc. continuent de fonctionner).
     */
    public void syncStockFromVariants() {
        if (!hasVariants()) {
            return;
        }
        Map<String, Integer> totals = new HashMap<>();
        for (ProductVariant v : variants) {
            if (v.getSizeStocks() == null) continue;
            v.getSizeStocks().forEach((size, qty) -> totals.merge(size, qty != null ? qty : 0, Integer::sum));
        }
        if (sizeStocks == null) {
            sizeStocks = new HashMap<>();
        }
        sizeStocks.clear();
        sizeStocks.putAll(totals);
        stock = totals.values().stream().mapToInt(Integer::intValue).sum();
    }

    /** Stock disponible pour une taille (et une couleur si le produit en a). */
    public int getAvailableStock(ProductVariant variant, String size) {
        if (variant != null) {
            Integer v = variant.getSizeStocks() != null ? variant.getSizeStocks().get(size) : null;
            return v != null ? v : 0;
        }
        initializeSizeStocks();
        Integer v = sizeStocks.get(size);
        return v != null ? v : 0;
    }

    /** Ajoute (delta > 0) ou retire (delta < 0) du stock pour une taille / couleur. */
    public void adjustStock(ProductVariant variant, String size, int delta) {
        if (variant != null) {
            int current = variant.getSizeStocks().getOrDefault(size, 0);
            variant.getSizeStocks().put(size, Math.max(0, current + delta));
            syncStockFromVariants();
            return;
        }
        initializeSizeStocks();
        int current = sizeStocks.getOrDefault(size, 0);
        sizeStocks.put(size, Math.max(0, current + delta));
        stock = sizeStocks.values().stream().mapToInt(Integer::intValue).sum();
    }

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
        if (hasVariants()) {
            syncStockFromVariants();
        } else if (sizeStocks != null && !sizeStocks.isEmpty()) {
            stock = sizeStocks.values().stream().mapToInt(Integer::intValue).sum();
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
