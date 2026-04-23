from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .models import ScenarioORM, UserORM
from .auth import hash_password


def seed_scenarios(db: Session):
    count = db.scalar(select(text("COUNT(1) FROM scenarios")))
    if not count:
        items = [
            ScenarioORM(id=1, title="Job Interview",      description="Practice answering common job interview questions"),
            ScenarioORM(id=2, title="Daily Conversation", description="Practice everyday conversations in English"),
            ScenarioORM(id=3, title="Business Meeting",   description="Practice participating in business meetings"),
            ScenarioORM(id=4, title="Travel Situations",  description="Practice conversations you might have while traveling"),
        ]
        for it in items:
            try:
                db.add(it); db.commit()
            except Exception:
                db.rollback()


def seed_admin(db: Session):
    existing = db.execute(select(UserORM).where(UserORM.username == "admin")).scalar_one_or_none()
    if not existing:
        admin = UserORM(
            username="admin",
            email="admin@speaking-practice.app",
            hashed_password=hash_password("Admin123!"),  # GANTI di production!
            full_name="Administrator",
            role="admin",
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print("[SEED] Admin account created: admin / Admin123!")
