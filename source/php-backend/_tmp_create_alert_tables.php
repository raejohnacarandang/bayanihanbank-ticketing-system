<?php
/**
 * Run this to create alert tables
 */
require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/core/Database.php';

$cfg = require __DIR__ . '/config/database.php';
$dsn = "mysql:host={$cfg['host']};port={$cfg['port']};dbname={$cfg['database']}" . (!empty($cfg['charset']) ? ";charset={$cfg['charset']}" : '');
$pdo = new PDO($dsn, $cfg['username'], $cfg['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

$pdo->exec("
CREATE TABLE IF NOT EXISTS monitoring_alerts (
  id varchar(50) NOT NULL,
  branchId varchar(50) NOT NULL,
  `system` varchar(30) NOT NULL,
  `condition` varchar(50) NOT NULL,
  threshold decimal(10,2) NOT NULL,
  severity enum('info','warning','critical') NOT NULL DEFAULT 'warning',
  channels json NOT NULL,
  enabled tinyint(1) NOT NULL DEFAULT 1,
  createdBy varchar(50) DEFAULT NULL,
  createdAt varchar(100) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_alert_branch (branchId),
  KEY idx_alert_system (`system`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
");

$pdo->exec("
CREATE TABLE IF NOT EXISTS alert_notifications (
  id varchar(50) NOT NULL,
  alertId varchar(50) NOT NULL,
  branchId varchar(50) NOT NULL,
  `system` varchar(30) NOT NULL,
  message text NOT NULL,
  severity enum('info','warning','critical') NOT NULL,
  sentAt datetime NOT NULL,
  channel varchar(50) NOT NULL,
  status enum('sent','failed') NOT NULL DEFAULT 'sent',
  PRIMARY KEY (id),
  KEY idx_an_alert (alertId),
  KEY idx_an_branch (branchId),
  KEY idx_an_sent (sentAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
");

echo "Alert tables created\n";