package com.ecommerce.backend.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "departments")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Department {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, unique = true)
    private String name; // e.g. "FEMME", "HOMME", "ENFANT", "VOILÉES"

    @Column(name = "code", nullable = false)
    private String code; // e.g. "femme", "homme"

    @Column(name = "description")
    private String description;

    @Column(name = "subcategories", columnDefinition = "TEXT")
    private String subcategories; // Comma-separated list of subcategories

    @Column(name = "display_order")
    private Integer displayOrder;

    @Column(name = "active")
    @Builder.Default
    private Boolean active = true;
}
