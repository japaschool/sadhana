-- Reports saved before report_traces.order_key existed have every trace at 0, so their order would be arbitrary.
-- Graphs keep the order their traces were saved in; grids take practice order, as they were shown.
WITH unordered AS (
    SELECT report_id FROM report_traces GROUP BY report_id HAVING bool_and(order_key = 0)
), ranked AS (
    SELECT t.id, row_number() OVER (PARTITION BY t.report_id ORDER BY t.ctid) - 1 AS k
    FROM report_traces t
    JOIN reports r ON r.id = t.report_id
    WHERE r.report_type = 'graph' AND t.report_id IN (SELECT report_id FROM unordered)
    UNION ALL
    SELECT t.id, row_number() OVER (PARTITION BY t.report_id ORDER BY p.order_key, t.ctid) - 1
    FROM report_traces t
    JOIN reports r ON r.id = t.report_id
    JOIN user_practices p ON p.id = t.practice_id
    WHERE r.report_type = 'grid' AND t.report_id IN (SELECT report_id FROM unordered)
)
UPDATE report_traces SET order_key = ranked.k FROM ranked WHERE report_traces.id = ranked.id;
