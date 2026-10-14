package com.ecommerce.backend.controller;

import com.ecommerce.backend.model.Category;
import com.ecommerce.backend.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryRepository categoryRepository;

    @GetMapping
    public ResponseEntity<List<Category>> getAllCategories(@RequestParam(required = false) String department) {
        if (categoryRepository.count() == 0) {
            initDefaultCategories();
        }
        if (department != null && !department.trim().isEmpty()) {
            return ResponseEntity.ok(categoryRepository.findAllByDepartmentIgnoreCase(department.trim()));
        }
        return ResponseEntity.ok(categoryRepository.findAll());
    }

    private void initDefaultCategories() {
        Category dresses = Category.builder().name("Robes").department("Femme").build();
        Category tops = Category.builder().name("Hauts & Blouses").department("Femme").build();
        Category knitwear = Category.builder().name("Maille & Sweats").department("Femme").build();
        Category coats = Category.builder().name("Manteaux & Vestes").department("Femme").build();
        Category accessories = Category.builder().name("Accessoires").department("Femme").build();
        categoryRepository.saveAll(List.of(dresses, tops, knitwear, coats, accessories));
    }
}
