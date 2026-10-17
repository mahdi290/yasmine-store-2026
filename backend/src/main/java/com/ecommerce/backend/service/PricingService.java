package com.ecommerce.backend.service;

import com.ecommerce.backend.model.Product;
import com.ecommerce.backend.model.QuantityDiscountRule;
import com.ecommerce.backend.repository.CategoryRepository;
import com.ecommerce.backend.repository.ProductRepository;
import com.ecommerce.backend.repository.QuantityDiscountRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/**
 * Calcul des prix d'une commande côté serveur (on ne fait jamais confiance au prix
 * envoyé par le navigateur) : prix soldé du produit puis remise par quantité.
 *
 * Règle de calcul (dupliquée à l'identique dans frontend/src/app/services/discount.service.ts
 * pour l'affichage du panier) :
 *  - pour chaque règle active, les quantités sont additionnées selon la portée
 *    (un produit toutes couleurs confondues, une catégorie, ou tout le panier) ;
 *  - si le total atteint la quantité minimale, toutes les lignes concernées ont droit au %;
 *  - une ligne concernée par plusieurs règles garde la meilleure (les remises ne se cumulent pas).
 */
@Service
@RequiredArgsConstructor
public class PricingService {

    private final QuantityDiscountRuleRepository ruleRepository;
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;

    /** Ligne à chiffrer. unitPrice null = prix actuel du produit (soldé le cas échéant). */
    public record Line(Product product, int quantity, BigDecimal unitPrice) {}

    public record LineResult(BigDecimal unitPrice, BigDecimal subtotal, BigDecimal discountPercent,
                             BigDecimal discountAmount, BigDecimal total, Long ruleId) {}

    public record AppliedDiscount(Long ruleId, String label, BigDecimal percent, int quantity, BigDecimal amount) {}

    public record Quote(List<LineResult> lines, BigDecimal subtotal, BigDecimal discountAmount,
                        BigDecimal total, List<AppliedDiscount> discounts) {

        /** Texte enregistré sur la commande, ex. "Achetez 2, économisez 10% (Pulls) : 2 article(s), -16.00 DT". */
        public String describe() {
            if (discounts.isEmpty()) return null;
            StringJoiner joiner = new StringJoiner("\n");
            for (AppliedDiscount d : discounts) {
                joiner.add(d.label() + " : " + d.quantity() + " article(s), -" + d.amount().setScale(2, RoundingMode.HALF_UP) + " DT");
            }
            return joiner.toString();
        }
    }

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    /** 10.00 -> "10", 16.67 -> "16.67" */
    public static String formatPercent(BigDecimal percent) {
        return percent == null ? "0" : percent.stripTrailingZeros().toPlainString();
    }

    public static BigDecimal round2(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    public List<QuantityDiscountRule> activeRules() {
        return ruleRepository.findAllByActiveTrueOrderByIdAsc().stream()
                .filter(r -> r.getMinQuantity() != null && r.getMinQuantity() > 0
                        && r.getPercent() != null && r.getPercent().signum() > 0 && r.getPercent().compareTo(HUNDRED) < 0)
                .toList();
    }

    public Quote quote(List<Line> lines) {
        return quote(lines, activeRules());
    }

    public Quote quote(List<Line> lines, List<QuantityDiscountRule> rules) {
        int n = lines.size();
        BigDecimal[] bestPercent = new BigDecimal[n];
        Arrays.fill(bestPercent, BigDecimal.ZERO);
        QuantityDiscountRule[] bestRule = new QuantityDiscountRule[n];

        for (QuantityDiscountRule rule : rules) {
            for (List<Integer> group : groupsFor(rule, lines)) {
                int qty = group.stream().mapToInt(i -> lines.get(i).quantity()).sum();
                if (qty < rule.getMinQuantity()) continue;
                for (int i : group) {
                    if (rule.getPercent().compareTo(bestPercent[i]) > 0) {
                        bestPercent[i] = rule.getPercent();
                        bestRule[i] = rule;
                    }
                }
            }
        }

        List<LineResult> results = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal discount = BigDecimal.ZERO;
        Map<Long, int[]> qtyByRule = new LinkedHashMap<>();
        Map<Long, BigDecimal> amountByRule = new LinkedHashMap<>();
        Map<Long, QuantityDiscountRule> rulesById = new HashMap<>();

        for (int i = 0; i < n; i++) {
            Line line = lines.get(i);
            BigDecimal unit = round2(line.unitPrice() != null ? line.unitPrice() : effectivePrice(line.product()));
            BigDecimal lineSubtotal = round2(unit.multiply(BigDecimal.valueOf(line.quantity())));
            BigDecimal lineDiscount = round2(lineSubtotal.multiply(bestPercent[i]).divide(HUNDRED));
            QuantityDiscountRule rule = bestRule[i];

            results.add(new LineResult(unit, lineSubtotal, bestPercent[i], lineDiscount, lineSubtotal.subtract(lineDiscount),
                    rule != null ? rule.getId() : null));
            subtotal = subtotal.add(lineSubtotal);
            discount = discount.add(lineDiscount);

            if (rule != null) {
                rulesById.put(rule.getId(), rule);
                qtyByRule.computeIfAbsent(rule.getId(), k -> new int[1])[0] += line.quantity();
                amountByRule.merge(rule.getId(), lineDiscount, BigDecimal::add);
            }
        }

        List<AppliedDiscount> applied = new ArrayList<>();
        for (Long ruleId : qtyByRule.keySet()) {
            QuantityDiscountRule rule = rulesById.get(ruleId);
            applied.add(new AppliedDiscount(ruleId, labelOf(rule), rule.getPercent(), qtyByRule.get(ruleId)[0], amountByRule.get(ruleId)));
        }

        return new Quote(results, round2(subtotal), round2(discount), round2(subtotal.subtract(discount)), applied);
    }

    /** Prix unitaire actuel : prix soldé si le produit est en solde. */
    public static BigDecimal effectivePrice(Product product) {
        BigDecimal p = product.getSalePrice();
        return p != null ? p : BigDecimal.ZERO;
    }

    private List<List<Integer>> groupsFor(QuantityDiscountRule rule, List<Line> lines) {
        String scope = rule.getScope() != null ? rule.getScope() : QuantityDiscountRule.SCOPE_ALL_PRODUCTS;
        List<List<Integer>> groups = new ArrayList<>();
        switch (scope) {
            case QuantityDiscountRule.SCOPE_CART -> {
                List<Integer> all = new ArrayList<>();
                for (int i = 0; i < lines.size(); i++) all.add(i);
                groups.add(all);
            }
            case QuantityDiscountRule.SCOPE_CATEGORY -> {
                List<Integer> group = new ArrayList<>();
                for (int i = 0; i < lines.size(); i++) {
                    Product p = lines.get(i).product();
                    if (p.getCategory() != null && Objects.equals(p.getCategory().getId(), rule.getCategoryId())) group.add(i);
                }
                groups.add(group);
            }
            case QuantityDiscountRule.SCOPE_PRODUCT -> {
                List<Integer> group = new ArrayList<>();
                for (int i = 0; i < lines.size(); i++) {
                    if (Objects.equals(lines.get(i).product().getId(), rule.getProductId())) group.add(i);
                }
                groups.add(group);
            }
            default -> {
                // Chaque produit séparément : ses couleurs et tailles comptent ensemble
                Map<Long, List<Integer>> byProduct = new LinkedHashMap<>();
                for (int i = 0; i < lines.size(); i++) {
                    byProduct.computeIfAbsent(lines.get(i).product().getId(), k -> new ArrayList<>()).add(i);
                }
                groups.addAll(byProduct.values());
            }
        }
        return groups;
    }

    /** Nom de la cible de la règle (catégorie / produit), null pour les portées globales. */
    public String targetName(QuantityDiscountRule rule) {
        if (QuantityDiscountRule.SCOPE_CATEGORY.equals(rule.getScope()) && rule.getCategoryId() != null) {
            return categoryRepository.findById(rule.getCategoryId()).map(c -> c.getName()).orElse(null);
        }
        if (QuantityDiscountRule.SCOPE_PRODUCT.equals(rule.getScope()) && rule.getProductId() != null) {
            return productRepository.findById(rule.getProductId()).map(Product::getName).orElse(null);
        }
        return null;
    }

    public String labelOf(QuantityDiscountRule rule) {
        if (rule.getLabel() != null && !rule.getLabel().isBlank()) {
            return rule.getLabel().trim();
        }
        String base = "Achetez " + rule.getMinQuantity() + ", économisez " + formatPercent(rule.getPercent()) + "%";
        String target = targetName(rule);
        return target != null ? base + " (" + target + ")" : base;
    }
}
