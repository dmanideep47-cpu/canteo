package com.canteo.controller;

import com.canteo.dto.QueueStatusDto;
import com.canteo.service.QueueService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/queue")
@CrossOrigin(origins = "*")
public class QueueController {

    private final QueueService queueService;

    public QueueController(QueueService queueService) {
        this.queueService = queueService;
    }

    @GetMapping("/status")
    public ResponseEntity<QueueStatusDto> getQueueStatus() {
        return ResponseEntity.ok(queueService.getQueueStatus());
    }
}
