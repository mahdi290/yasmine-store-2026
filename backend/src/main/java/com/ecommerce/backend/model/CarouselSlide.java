package com.ecommerce.backend.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "carousel_slides")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CarouselSlide {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "badge")
    private String badge;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "subtitle", columnDefinition = "TEXT")
    private String subtitle;

    @Column(name = "btn_text")
    private String btnText;

    @Column(name = "link")
    private String link;

    @Column(name = "image_url", columnDefinition = "LONGTEXT")
    private String imageUrl;

    @Column(name = "display_order")
    private Integer displayOrder;

    @Column(name = "active")
    @Builder.Default
    private Boolean active = true;
}
