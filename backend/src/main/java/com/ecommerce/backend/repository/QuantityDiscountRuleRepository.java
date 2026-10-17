package com.ecommerce.backend.repository;

import com.ecommerce.backend.model.QuantityDiscountRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuantityDiscountRuleRepository extends JpaRepository<QuantityDiscountRule, Long> {
    List<QuantityDiscountRule> findAllByActiveTrueOrderByIdAsc();
    List<QuantityDiscountRule> findAllByOrderByIdAsc();
}
