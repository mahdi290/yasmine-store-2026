package com.ecommerce.backend.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "showcase_cards")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShowcaseCard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "card_key", unique = true, nullable = false)
    private String cardKey;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "badge")
    private String badge;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "image_url", columnDefinition = "LONGTEXT")
    private String imageUrl;

    @Column(name = "category_query_name")
    private String categoryQueryName;

    @Column(name = "col_class")
    private String colClass;

    @Column(name = "display_order")
    private Integer displayOrder;
}
