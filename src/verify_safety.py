import sqlite3

conn = sqlite3.connect("db/recoverai.db")
c = conn.cursor()

print("--- Duplicate idempotency keys (should be empty) ---")
c.execute("SELECT idempotency_key, COUNT(*) FROM recovery_actions GROUP BY idempotency_key HAVING COUNT(*) > 1")
print(c.fetchall())

print("\n--- risk_flag actions taken (should be only 'escalate') ---")
c.execute("""
    SELECT ra.action_type, COUNT(*) FROM diagnoses d
    JOIN recovery_actions ra ON d.diagnosis_id = ra.diagnosis_id
    WHERE d.predicted_root_cause = 'risk_flag'
    GROUP BY ra.action_type
""")
print(c.fetchall())

print("\n--- Low-confidence diagnoses (<0.7) action taken (should be only 'escalate'/'stop') ---")
c.execute("""
    SELECT ra.action_type, COUNT(*) FROM diagnoses d
    JOIN recovery_actions ra ON d.diagnosis_id = ra.diagnosis_id
    WHERE d.confidence < 0.7
    GROUP BY ra.action_type
""")
print(c.fetchall())

conn.close()
