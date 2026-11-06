<?php
/**
 * GET /api/monitoring/daily?date=YYYY-MM-DD
 *
 * Returns the frozen end-of-day branch health for a single day, used by the
 * Daily Report tab in the reports screen.
 *
 * Without `date`, the most recent day that has a captured snapshot is used.
 * `availableDates` lists the days that actually have snapshots so the UI can
 * tell the user which dates are reportable. The prior snapshot day is returned
 * alongside it so the report can show day-over-day changes in one request.
 *
 * Filtering by role mirrors /api/monitoring:
 *   - IT_STAFF      → only branches the specialist is actively assigned to
 *   - BRANCH_USER   → only their own branch
 *   - ADMIN/AUDITOR → all branches
 */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/daily_snapshot.php';

$user = Middleware::authenticate();
$role = $user['role'];

/** Branch ids this role is allowed to see, or null for "no restriction". */
function dailyVisibleBranchIds(array $user): ?array {
    if ($user['role'] === 'IT_STAFF') {
        $assignments = json_decode($user['assignments'] ?? '[]', true) ?: [];
        $ids = [];
        foreach ($assignments as $a) {
            $expires = strtotime($a['expiresAt'] ?? '');
            if (isset($a['branchId']) && ($expires === false || $expires > time())) {
                $ids[] = $a['branchId'];
            }
        }
        return array_values(array_unique($ids));
    }
    if ($user['role'] === 'BRANCH_USER') {
        return [$user['branchId']];
    }
    return null;
}

$visible = dailyVisibleBranchIds($user);

$requested = isset($_GET['date']) ? trim((string)$_GET['date']) : '';
if ($requested !== '' && DailySnapshot::normalizeDate($requested) === null) {
    http_response_code(422);
    echo json_encode(['error' => 'Invalid date. Expected YYYY-MM-DD.']);
    exit;
}

try {
    $availableDates = DailySnapshot::availableDates();

    if ($requested === '') {
        $requested = $availableDates[0]['snapshotDate'] ?? '';
    }

    /** Rows for one snapshot day, narrowed to the branches this role may see. */
    $rowsFor = function (string $date) use ($visible): array {
        $sql = "SELECT * FROM branch_health_daily WHERE snapshotDate = ?";
        $params = [$date];

        if ($visible !== null) {
            if (empty($visible)) {
                return [];
            }
            $placeholders = implode(',', array_fill(0, count($visible), '?'));
            $sql .= " AND branchId IN ($placeholders)";
            $params = array_merge($params, $visible);
        }

        $sql .= " ORDER BY branchId, `system`";
        return Database::fetchAll($sql, $params) ?: [];
    };

    $snapshots = [];
    $previousDate = '';
    $previousSnapshots = [];

    if ($requested !== '') {
        $snapshots = $rowsFor($requested);

        // $availableDates is newest-first, so the prior day that has a
        // snapshot is the first entry that sorts before the requested date.
        foreach ($availableDates as $entry) {
            if (($entry['snapshotDate'] ?? '') < $requested) {
                $previousDate = $entry['snapshotDate'];
                $previousSnapshots = $rowsFor($previousDate);
                break;
            }
        }
    }
} catch (\Throwable $e) {
    // The snapshot table is created by daily_snapshot.php, so a deployment that
    // has not run it yet simply has no history to report.
    $availableDates = [];
    $snapshots = [];
    $previousDate = '';
    $previousSnapshots = [];
    $requested = '';
}

echo json_encode([
    'date' => $requested,
    'previousDate' => $previousDate,
    'availableDates' => $availableDates,
    'snapshots' => array_values($snapshots),
    'previousSnapshots' => array_values($previousSnapshots),
]);
