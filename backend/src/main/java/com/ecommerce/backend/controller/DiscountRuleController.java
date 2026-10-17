package com.ecommerce.backend.controller;

import com.ecommerce.backend.model.QuantityDiscountRule;
import com.ecommerce.backend.repository.CategoryRepository;
import com.ecommerce.backend.repository.ProductRepository;
import com.ecommerce.backend.repository.QuantityDiscountRuleRepository;
import com.ecommerce.backend.service.PricingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Remises par quantité.
 *  - GET  /api/discount-rules              : règles actives (public, pour la fiche produit et le panier)
 *  - CRUD /api/admin/discount-rules/**     : gestion dans l'admin (rôle ADMIN, cf. SecurityConfig)
 */
@RestController
@RequiredArgsConstructor
public class DiscountRuleController {

    private static final Set<String> SCOPES = Set.of(
            QuantityDiscountRule.SCOPE_ALL_PRODUCTS,
            QuantityDiscountRule.SCOPE_CART,
            QuantityDiscountRule.SCOPE_CATEGORY,
            QuantityDiscountRule.SCOPE_PRODUCT);

    private final QuantityDiscountRuleRepository ruleRepository;
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final PricingService pricingService;

    public record RuleResponse(Long id, String label, String displayLabel, Integer minQuantity, BigDecimal percent,
                               Boolean active, String scope, Long categoryId, Long productId, String targetName) {}

    public record RuleRequest(String label, Integer minQuantity, BigDecimal percent, Boolean active,
                              String scope, Long categoryId, Long productId) {}

    private RuleResponse toResponse(QuantityDiscountRule r) {
        return new RuleResponse(r.getId(), r.getLabel(), pricingService.labelOf(r), r.getMinQuantity(), r.getPercent(),
                r.getActive(), r.getScope(), r.getCategoryId(), r.getProductId(), pricingService.targetName(r));
    }

    @GetMapping("/api/discount-rules")
    public List<RuleResponse> activeRules() {
        return pricingService.activeRules().stream().map(this::toResponse).toList();
    }

    @GetMapping("/api/admin/discount-rules")
    public List<RuleResponse> allRules() {
        return ruleRepository.findAllByOrderByIdAsc().stream().map(this::toResponse).toList();
    }

    @PostMapping("/api/admin/discount-rules")
    public ResponseEntity<?> create(@RequestBody RuleRequest req) {
        QuantityDiscountRule rule = new QuantityDiscountRule();
        String error = apply(rule, req);
        if (error != null) {
            return ResponseEntity.badRequest().body(Map.of("error", error));
        }
        return ResponseEntity.ok(toResponse(ruleRepository.save(rule)));
    }

    @PutMapping("/api/admin/discount-rules/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody RuleRequest req) {
        QuantityDiscountRule rule = ruleRepository.findById(id).orElse(null);
        if (rule == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Règle de remise introuvable."));
        }
        String error = apply(rule, req);
        if (error != null) {
            return ResponseEntity.badRequest().body(Map.of("error", error));
        }
        return ResponseEntity.ok(toResponse(ruleRepository.save(rule)));
    }

    @PatchMapping("/api/admin/discount-rules/{id}/toggle")
    public ResponseEntity<?> toggle(@PathVariable Long id) {
        QuantityDiscountRule rule = ruleRepository.findById(id).orElse(null);
        if (rule == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Règle de remise introuvable."));
        }
        rule.setActive(!Boolean.TRUE.equals(rule.getActive()));
        return ResponseEntity.ok(toResponse(ruleRepository.save(rule)));
    }

    @DeleteMapping("/api/admin/discount-rules/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!ruleRepository.existsById(id)) {
            return ResponseEntity.status(404).body(Map.of("error", "Règle de remise introuvable."));
        }
        ruleRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Règle de remise supprimée."));
    }

    /** Valide la requête et copie les champs dans la règle ; renvoie un message d'erreur en français ou null. */
    private String apply(QuantityDiscountRule rule, RuleRequest req) {
        if (req.minQuantity() == null || req.minQuantity() < 1 || req.minQuantity() > 999) {
            return "La quantité minimale doit être comprise entre 1 et 999.";
        }
        // Arrondi à 2 décimales (16.667 -> 16.67) plutôt que de refuser la saisie
        BigDecimal percent = req.percent() != null ? req.percent().setScale(2, java.math.RoundingMode.HALF_UP) : null;
        if (percent == null || percent.compareTo(new BigDecimal("0.01")) < 0 || percent.compareTo(new BigDecimal("90")) > 0) {
            return "Le pourcentage de remise doit être compris entre 0,01 et 90 %.";
        }
        String scope = req.scope() != null ? req.scope().trim().toUpperCase() : QuantityDiscountRule.SCOPE_ALL_PRODUCTS;
        if (!SCOPES.contains(scope)) {
            return "Portée de remise invalide.";
        }
        Long categoryId = null;
        Long productId = null;
        if (QuantityDiscountRule.SCOPE_CATEGORY.equals(scope)) {
            if (req.categoryId() == null || !categoryRepository.existsById(req.categoryId())) {
                return "Veuillez choisir une catégorie valide.";
            }
            categoryId = req.categoryId();
        }
        if (QuantityDiscountRule.SCOPE_PRODUCT.equals(scope)) {
            if (req.productId() == null || !productRepository.existsById(req.productId())) {
                return "Veuillez choisir un produit valide.";
            }
            productId = req.productId();
        }
        rule.setLabel(req.label() != null && !req.label().isBlank() ? req.label().trim() : null);
        rule.setMinQuantity(req.minQuantity());
        rule.setPercent(percent);
        rule.setActive(req.active() == null || req.active());
        rule.setScope(scope);
        rule.setCategoryId(categoryId);
        rule.setProductId(productId);
        return null;
    }
}
