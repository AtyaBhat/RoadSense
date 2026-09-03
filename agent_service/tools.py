from langchain_core.tools import tool
import psycopg2

DB_CONFIG = {
    "host": "localhost",
    "database": "Pothole",
    "user": "postgres",
    "password": "1234",
    "port": 5432,
}


@tool
def estimate_severity(damage_type: str,bbox_area: float,confidence: float,) -> str:
    """
    Estimate the severity of detected road damage using
    damage type, bounding box area, and detection confidence.
    """

    # Base severity for each damage type
    base = {
        "pothole": 2,
        "alligator_crack": 2,
        "longitudinal_crack": 1,
        "transverse_crack": 1,
        "edge_crack": 1,
        "patching": 0,
        "rutting": 2,
        "garbage": 0,
        "Working": 0,
        "Not Working": 2,
    }

    score = base.get(damage_type, 1) # if value not found, default to 1

    # Larger damage -> increase severity
    if bbox_area > 0.25:
        score += 2
    elif bbox_area > 0.10:
        score += 1

    # High confidence -> slightly increase confidence in severity
    if confidence > 0.90:
        score += 1
    elif confidence < 0.60:
        score -= 1

    score = max(0, min(score, 3))

    levels = ["low", "medium", "high", "critical"]
    return levels[score]


@tool
def check_duplicate(location: str, damage_type: str) -> str:
    """
    Check if a similar damage report exists
    in the last 30 days.
    """

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    query = """
    SELECT COUNT(*)
    FROM reports
    WHERE
        structured_report->>'damage_type' = %s   
        AND structured_report->>'location' ILIKE %s
        AND created_at >= NOW() - INTERVAL '30 days';
    """

    cur.execute(
        query,
        (
            damage_type,
            f"%{location}%"
        )
    )

    count = cur.fetchone()[0]

    cur.close()
    conn.close()

    if count == 0:
        return "No duplicates found."

    if count == 1:
        return "1 existing report nearby."

    return f"{count} existing reports nearby."