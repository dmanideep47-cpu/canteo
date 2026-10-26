package com.canteo.service;

import com.canteo.dto.MenuItemDto;
import com.canteo.exception.ResourceNotFoundException;
import com.canteo.model.MenuItem;
import com.canteo.repository.MenuItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class MenuService {

    private final MenuItemRepository menuItemRepository;

    public MenuService(MenuItemRepository menuItemRepository) {
        this.menuItemRepository = menuItemRepository;
    }

    public List<MenuItemDto> getAllMenuItems() {
        return menuItemRepository.findByAvailableTrue().stream()
                .map(MenuItemDto::fromEntity)
                .collect(Collectors.toList());
    }

    public MenuItemDto getMenuItemById(Long id) {
        MenuItem item = menuItemRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Menu item not found with id: " + id));
        return MenuItemDto.fromEntity(item);
    }

    public List<String> getCategories() {
        return menuItemRepository.findDistinctCategories();
    }
}
