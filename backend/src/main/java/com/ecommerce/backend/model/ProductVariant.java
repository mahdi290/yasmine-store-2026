package com.ecommerce.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Variante couleur d'un produit (ex. pull rayé blanc / rouge / bleu).
 * Chaque couleur a son nom, sa pastille, ses photos et son stock par taille.
 */
@Entity
@Table(name = "product_variants")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class ProductVariant {

    private static final String IMAGE_SEPARATOR = "\n";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    @JsonIgnore
    @ToString.Exclude
    private Product product;

    @Column(name = "color_name", nullable = false)
    private String colorName;

    // Code couleur de la pastille, ex. "#8B1E2D"
    @Column(name = "color_hex", length = 20)
    private String colorHex;

    // Photos de la couleur, une URL par ligne (la première est la photo principale)
    @Column(name = "images", columnDefinition = "LONGTEXT")
    @JsonIgnore
    private String imagesData;

    @ElementCollection(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SELECT)
    @CollectionTable(name = "product_variant_size_stocks", joinColumns = @JoinColumn(name = "variant_id"))
    @MapKeyColumn(name = "size")
    @Column(name = "stock")
    @Builder.Default
    private Map<String, Integer> sizeStocks = new HashMap<>();

    @JsonProperty("images")
    public List<String> getImages() {
        if (imagesData == null || imagesData.isBlank()) {
            return new ArrayList<>();
        }
        return new ArrayList<>(Arrays.stream(imagesData.split(IMAGE_SEPARATOR))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList());
    }

    @JsonProperty("images")
    public void setImages(List<String> images) {
        if (images == null) {
            this.imagesData = null;
            return;
        }
        this.imagesData = String.join(IMAGE_SEPARATOR, images.stream()
                .filter(s -> s != null && !s.isBlank())
                .map(String::trim)
                .toList());
    }

    // Photo principale de la couleur
    @JsonProperty("imageUrl")
    public String getImageUrl() {
        List<String> images = getImages();
        return images.isEmpty() ? null : images.get(0);
    }

    @JsonProperty("stock")
    public int getStock() {
        if (sizeStocks == null) return 0;
        return sizeStocks.values().stream().filter(v -> v != null).mapToInt(Integer::intValue).sum();
    }
}
