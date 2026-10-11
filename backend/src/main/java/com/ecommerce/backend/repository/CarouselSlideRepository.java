package com.ecommerce.backend.repository;

import com.ecommerce.backend.model.CarouselSlide;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CarouselSlideRepository extends JpaRepository<CarouselSlide, Long> {
    List<CarouselSlide> findAllByActiveTrueOrderByDisplayOrderAsc();
    List<CarouselSlide> findAllByOrderByDisplayOrderAsc();
}
