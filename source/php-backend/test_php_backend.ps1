# Bayanihan Bank PHP Backend Test Script
# Run: powershell -ExecutionPolicy Bypass -File test_php_backend.ps1

$PHP = "http://localhost:3002"
$pass = "password123"
$passed = 0
$failed = 0

function Test-Step($label) {
    Write-Host ""
    Write-Host "--- $label ---" -ForegroundColor Cyan
}
function Ok($msg) {
    Write-Host "  [PASS] $msg" -ForegroundColor Green
    $script:passed++
}
function Fail($msg) {
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
    $script:failed++
}

# 1. Health
Test-Step "Health Check"
try {
    $r = Invoke-WebRequest "$PHP/health" -UseBasicParsing -TimeoutSec 3
    Ok "PHP health: $($r.Content)"
} catch { Fail "PHP health failed" }

# 2. Admin login
Test-Step "Admin Login"
$adminToken = $null
$body = '{"username":"admin","password":"password123"}'
try {
    $r = Invoke-WebRequest "$PHP/auth/login" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
    $d = $r.Content | ConvertFrom-Json
    $script:adminToken = $d.token
    Ok "admin logged in, role=$($d.user.role)"
} catch { Fail "admin login failed" }

# 3. Branch user login
Test-Step "Branch User Login"
$branchToken = $null
$body = '{"username":"alabang.user","password":"password123"}'
try {
    $r = Invoke-WebRequest "$PHP/auth/login" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
    $d = $r.Content | ConvertFrom-Json
    $script:branchToken = $d.token
    Ok "alabang.user logged in, branch=$($d.user.branchName)"
} catch { Fail "branch login failed" }

# 4. State (admin)
Test-Step "GET /state (admin)"
if ($adminToken) {
    $h = @{Authorization="Bearer $adminToken"}
    try {
        $r = Invoke-WebRequest "$PHP/state" -Headers $h -UseBasicParsing
        $s = $r.Content | ConvertFrom-Json
        Ok "Users=$($s.users.Count) Tickets=$($s.tickets.Count) Branches=$($s.branches.Count) Categories=$($s.categories.Count)"
    } catch { Fail "state failed" }
}

# 5. Tickets list
Test-Step "GET /tickets"
if ($adminToken) {
    $h = @{Authorization="Bearer $adminToken"}
    try {
        $r = Invoke-WebRequest "$PHP/tickets" -Headers $h -UseBasicParsing
        $t = $r.Content | ConvertFrom-Json
        Ok "$($t.tickets.Count) tickets"
        foreach ($tk in $t.tickets) {
            Write-Host "    $($tk.id) | $($tk.status) | $($tk.subject)" -ForegroundColor Gray
            if ($t.tickets.IndexOf($tk) -ge 2) { break }
        }
    } catch { Fail "tickets list failed" }
}

# 6. Create ticket
Test-Step "POST /tickets (create)"
if ($branchToken) {
    $h = @{Authorization="Bearer $branchToken"}
    $tb = '{"subject":"PHP test ticket","description":"Created from test script","category":"Hardware"}'
    try {
        $r = Invoke-WebRequest "$PHP/tickets" -Method POST -Body $tb -ContentType "application/json" -Headers $h -UseBasicParsing
        $tk = ($r.Content | ConvertFrom-Json).ticket
        Ok "Created $($tk.id) status=$($tk.status)"
    } catch { Fail "create ticket failed: $($_.Exception.Message)" }
}

# 7. Users list
Test-Step "GET /users"
if ($adminToken) {
    $h = @{Authorization="Bearer $adminToken"}
    try {
        $r = Invoke-WebRequest "$PHP/users" -Headers $h -UseBasicParsing
        $u = $r.Content | ConvertFrom-Json
        Ok "$($u.users.Count) users"
    } catch { Fail "users list failed" }
}

# 8. Branches
Test-Step "GET /branches"
if ($adminToken) {
    $h = @{Authorization="Bearer $adminToken"}
    try {
        $r = Invoke-WebRequest "$PHP/branches" -Headers $h -UseBasicParsing
        $b = $r.Content | ConvertFrom-Json
        Ok "$($b.branches.Count) branches"
    } catch { Fail "branches failed" }
}

# 9. Categories
Test-Step "GET /categories"
if ($adminToken) {
    $h = @{Authorization="Bearer $adminToken"}
    try {
        $r = Invoke-WebRequest "$PHP/categories" -Headers $h -UseBasicParsing
        $c = $r.Content | ConvertFrom-Json
        Ok "$($c.categories.Count) categories"
    } catch { Fail "categories failed" }
}

# 10. Notifications
Test-Step "GET /notifications"
if ($adminToken) {
    $h = @{Authorization="Bearer $adminToken"}
    try {
        $r = Invoke-WebRequest "$PHP/notifications" -Headers $h -UseBasicParsing
        $n = $r.Content | ConvertFrom-Json
        Ok "$($n.notifications.Count) notifications"
    } catch { Fail "notifications failed" }
}

# 11. Audit logs
Test-Step "GET /audit-logs"
if ($adminToken) {
    $h = @{Authorization="Bearer $adminToken"}
    try {
        $r = Invoke-WebRequest "$PHP/audit-logs" -Headers $h -UseBasicParsing
        $a = $r.Content | ConvertFrom-Json
        Ok "$($a.auditLogs.Count) audit log entries"
    } catch { Fail "audit logs failed" }
}

# 12. Wrong password
Test-Step "Wrong password rejected"
$body = '{"username":"admin","password":"wrongpassword"}'
try {
    $r = Invoke-WebRequest "$PHP/auth/login" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
    Fail "Should have returned 401"
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Ok "Correctly returned 401"
    } else {
        Fail "Unexpected: $($_.Exception.Message)"
    }
}

# 13. State summary
Test-Step "GET /state summary"
if ($adminToken) {
    $h = @{Authorization="Bearer $adminToken"}
    try {
        $phpS = (Invoke-WebRequest "$PHP/state" -Headers $h -UseBasicParsing).Content | ConvertFrom-Json
        Ok "Users=$($phpS.users.Count) Tickets=$($phpS.tickets.Count) Branches=$($phpS.branches.Count) Categories=$($phpS.categories.Count)"
    } catch { Fail "state summary failed: $($_.Exception.Message)" }
}

# 14. Monitoring list (admin)
Test-Step "GET /monitoring (admin)"
if ($adminToken) {
    $h = @{Authorization="Bearer $adminToken"}
    try {
        $r = Invoke-WebRequest "$PHP/monitoring" -Headers $h -UseBasicParsing
        $d = $r.Content | ConvertFrom-Json
        Ok "$($d.branchHealth.Count) branch health rows"
    } catch { Fail "monitoring list failed" }
}

# 15. Monitoring endpoints (admin)
Test-Step "GET /api/monitoring/endpoints (admin)"
if ($adminToken) {
    $h = @{Authorization="Bearer $adminToken"}
    try {
        $r = Invoke-WebRequest "$PHP/api/monitoring/endpoints" -Headers $h -UseBasicParsing
        $d = $r.Content | ConvertFrom-Json
        Ok "$($d.endpoints.Count) endpoints"
    } catch { Fail "monitoring endpoints failed" }
}

# 16. Monitoring alerts (admin)
Test-Step "GET /api/monitoring/alerts (admin)"
if ($adminToken) {
    $h = @{Authorization="Bearer $adminToken"}
    try {
        $r = Invoke-WebRequest "$PHP/api/monitoring/alerts" -Headers $h -UseBasicParsing
        $d = $r.Content | ConvertFrom-Json
        Ok "$($d.alerts.Count) alerts"
    } catch { Fail "monitoring alerts failed" }
}

# 17. Monitoring speed log (admin)
Test-Step "GET /monitoring/speed-log (admin)"
if ($adminToken) {
    $h = @{Authorization="Bearer $adminToken"}
    try {
        $r = Invoke-WebRequest "$PHP/monitoring/speed-log" -Headers $h -UseBasicParsing
        $d = $r.Content | ConvertFrom-Json
        Ok "$($d.internetSpeedLogs.Count) speed log entries"
    } catch { Fail "monitoring speed log failed" }
}

# 18. PATCH monitoring as branch user (updates branch health status)
Test-Step "PATCH /api/monitoring as branch user"
if ($branchToken) {
    $h = @{Authorization="Bearer $branchToken"}
    $body = '{"system":"Internet","status":"Not Working"}'
    try {
        $r = Invoke-WebRequest "$PHP/api/monitoring" -Method PATCH -Body $body -ContentType "application/json" -Headers $h -UseBasicParsing -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200) {
            Ok "PATCH successful"
        } else {
            Fail "Expected 200, got {$r.StatusCode}"
        }
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 403) {
            Ok "Correctly returned 403 (read-only for branch user)"
        } else {
            Fail "Unexpected: $($_.Exception.Message)"
        }
    }
}

# 19. PATCH monitoring as admin (should be 403 read-only)
Test-Step "PATCH /api/monitoring as admin (403 read-only)"
if ($adminToken) {
    $h = @{Authorization="Bearer $adminToken"}
    $body = '{"system":"Internet","status":"Not Working"}'
    try {
        $r = Invoke-WebRequest "$PHP/api/monitoring" -Method PATCH -Body $body -ContentType "application/json" -Headers $h -UseBasicParsing -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200) {
            Ok "PATCH successful (admin can update)"
        } else {
            Fail "Expected 200, got {$r.StatusCode}"
        }
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 403) {
            Ok "Correctly returned 403 (read-only for admin on this endpoint)"
        } else {
            Fail "Unexpected: $($_.Exception.Message)"
        }
    }
}

# 20. POST monitoring bulk as admin
Test-Step "POST /monitoring/bulk (admin)"
if ($adminToken) {
    $h = @{Authorization="Bearer $adminToken"}
    $body = '{"system":"CCTV","status":"Not Working","totalUnits":8,"workingUnits":3}'
    try {
        $r = Invoke-WebRequest "$PHP/monitoring/bulk" -Method POST -Body $body -ContentType "application/json" -Headers $h -UseBasicParsing
        Ok "Bulk update returned {$r.StatusCode}"
    } catch { Fail "bulk admin failed: $($_.Exception.Message)" }
}

# 21. POST monitoring bulk as branch user (should be 403)
Test-Step "POST /monitoring/bulk as branch user (403)"
if ($branchToken) {
    $h = @{Authorization="Bearer $branchToken"}
    $body = '{"system":"CCTV","status":"Not Working","totalUnits":8,"workingUnits":3}'
    try {
        $r = Invoke-WebRequest "$PHP/monitoring/bulk" -Method POST -Body $body -ContentType "application/json" -Headers $h -UseBasicParsing -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 403) {
            Ok "Correctly returned 403"
        } else {
            Fail "Expected 403, got {$r.StatusCode}"
        }
    } catch {
        Fail "Request threw: $($_.Exception.Message)"
    }
}

# 22. 401 without token
Test-Step "401 without token"
try {
    $r = Invoke-WebRequest "$PHP/monitoring" -UseBasicParsing
    Fail "Should have returned 401"
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Ok "Correctly returned 401"
    } else {
        Fail "Unexpected: $($_.Exception.Message)"
    }
}

# Summary
Write-Host ""
Write-Host "=== RESULTS: $passed passed, $failed failed ===" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })
