package com.ecommerce.backend.controller;

import com.ecommerce.backend.model.Department;
import com.ecommerce.backend.repository.DepartmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/departments")
@RequiredArgsConstructor
public class DepartmentController {

    private final DepartmentRepository departmentRepository;

    @GetMapping
    public ResponseEntity<List<Department>> getActiveDepartments() {
        List<Department> departments = departmentRepository.findAllByActiveTrueOrderByDisplayOrderAsc();
        if (departments.isEmpty()) {
            departments = initDefaultDepartments();
        }
        return ResponseEntity.ok(departments);
    }

    private List<Department> initDefaultDepartments() {
        Department femme = Department.builder()
                .name("FEMME")
                .code("femme")
                .description("Prêt-à-porter et collections féminines")
                .subcategories("Robes, Hauts & Blouses, Maille, Manteaux & Vestes, Accessoires, Ensembles, Jupes")
                .displayOrder(1)
                .active(true)
                .build();

        Department homme = Department.builder()
                .name("HOMME")
                .code("homme")
                .description("Mode masculine et pièces élégantes")
                .subcategories("Chemises & Polos, Pantalons, Costumes, Manteaux & Vestes, Chaussures, Accessoires")
                .displayOrder(2)
                .active(true)
                .build();

        return departmentRepository.saveAll(List.of(femme, homme));
    }
}
