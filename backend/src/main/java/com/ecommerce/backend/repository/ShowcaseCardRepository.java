package com.ecommerce.backend.repository;

import com.ecommerce.backend.model.ShowcaseCard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShowcaseCardRepository extends JpaRepository<ShowcaseCard, Long> {
    Optional<ShowcaseCard> findByCardKey(String cardKey);
    List<ShowcaseCard> findAllByOrderByDisplayOrderAsc();
}
