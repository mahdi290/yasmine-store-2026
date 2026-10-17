package com.ecommerce.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Règle de remise par quantité, configurable dans l'admin.
 * Exemple : "Achetez 2 pulls, économisez 10%".
 */
@Entity
@Table(name = "quantity_discount_rules")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class QuantityDiscountRule {

    /** Portée de la règle : quelles quantités sont additionnées pour atteindre le minimum. */
    public static final String SCOPE_ALL_PRODUCTS = "ALL_PRODUCTS"; // chaque produit séparément (toutes couleurs/tailles confondues)
    public static final String SCOPE_CART = "CART";                 // tout le panier
    public static final String SCOPE_CATEGORY = "CATEGORY";         // tous les produits d'une catégorie ensemble
    public static final String SCOPE_PRODUCT = "PRODUCT";           // un produit précis (toutes couleurs/tailles)

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Libellé affiché au client (optionnel, généré sinon)
    @Column(name = "label")
    private String label;

    @Column(name = "min_quantity", nullable = false)
    private Integer minQuantity;

    // Pourcentage avec 2 décimales (ex. 16.67 pour "2 hauts à 50 DT au lieu de 60 DT")
    @Column(name = "percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal percent;

    @Column(name = "active")
    @Builder.Default
    private Boolean active = true;

    @Column(name = "scope", nullable = false, length = 20)
    @Builder.Default
    private String scope = SCOPE_ALL_PRODUCTS;

    @Column(name = "category_id")
    private Long categoryId;

    @Column(name = "product_id")
    private Long productId;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
