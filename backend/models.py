from __future__ import annotations
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()


#region מחלקות
#region מחלקת בסיס
class BaseModel(db.Model):
    """מחלקת בסיס לכל המודלים - מספקת מתודת save() משותפת"""
    __abstract__ = True

    def save(self):
        """שמירת המופע במסד הנתונים"""
        db.session.add(self)
        db.session.commit()
#endregion

#region מחלקת משתמש
class User(BaseModel):
    """מודל משתמש - מכיל פרטי התחברות, תפקיד והרשאות"""
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), default='Reader')
    is_approved_uploader = db.Column(db.Boolean, default=False)
    was_rejected = db.Column(db.Boolean, default=False)
    bio = db.Column(db.Text, default='')
    profile_views = db.Column(db.Integer, default=0)
    request_message = db.Column(db.String(500), nullable=True)  # הודעת בקשה להרשאות
    created_at = db.Column(db.DateTime, default=lambda: datetime.now())

    # קשרים
    ratings = db.relationship('Rating', backref='user', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password):
        """גיבוב סיסמה לפני שמירה"""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """בדיקת סיסמה מול גיבוב"""
        return check_password_hash(self.password_hash, password)
#endregion

#region מחלקת מתכון
class Recipe(BaseModel):
    """מודל מתכון - מכיל את כל פרטי המתכון, תמונות וקשר לרכיבים"""
    __tablename__ = 'recipes'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    image_path = db.Column(db.String(200), nullable=False)
    variation_paths = db.Column(db.Text)
    type = db.Column(db.String(20))
    category = db.Column(db.String(50))
    preparation_time = db.Column(db.Integer)
    instructions = db.Column(db.Text)  # ✅ תאימות אחורה - למתכונים ישנים
    steps = db.Column(db.JSON)  # ✅ שדה חדש - שלבים במבנה JSON
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    rating = db.Column(db.Float, default=0.0)
    rating_count = db.Column(db.Integer, default=0)
    ingredients_cache = db.Column(db.JSON, default=list)  # ✅ שדה חדש - cache של שמות רכיבים לחיפוש מהיר

    # קשרים
    ingredients = db.relationship('IngredientEntry', backref='recipe', lazy=True, cascade='all, delete-orphan')
    ratings = db.relationship('Rating', backref='recipe', lazy=True, cascade='all, delete-orphan')
    uploader = db.relationship('User', backref='recipes', foreign_keys=[user_id])
#endregion

#region מחלקת רכיב
class IngredientEntry(BaseModel):
    """מודל רכיב - מייצג רכיב בודד במתכון עם כמות ויחידה"""
    __tablename__ = 'ingredient_entries'

    id = db.Column(db.Integer, primary_key=True)
    product = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.String(50))
    unit = db.Column(db.String(50))
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipes.id'), nullable=False)
#endregion

#region מחלקת דירוג
class Rating(BaseModel):
    """מודל דירוג - שומר את דירוג כל משתמש לכל מתכון"""
    __tablename__ = 'ratings'

    id = db.Column(db.Integer, primary_key=True)
    score = db.Column(db.Float, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipes.id'), nullable=False)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'recipe_id', name='unique_user_recipe_rating'),
    )
#endregion

#region מחלקת מועדפים
class Favorite(BaseModel):
    """מודל מועדפים - שומר את המתכונים שהמשתמש אהב"""
    __tablename__ = 'favorites'

    id = db.Column(db.Integer, primary_key=True)
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipes.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now())

    __table_args__ = (
        db.UniqueConstraint('user_id', 'recipe_id', name='unique_user_recipe_favorite'),
    )
#endregion

#region מחלקת תגובות
class Comment(BaseModel):
    """מודל תגובה - תגובות על מתכונים"""
    __tablename__ = 'comments'

    id = db.Column(db.Integer, primary_key=True)
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipes.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now())

    # קשרים
    user = db.relationship('User', backref='comments')
    recipe = db.relationship('Recipe', backref='comments')
    likes = db.relationship('CommentLike', backref='comment', lazy=True, cascade='all, delete-orphan')
#endregion

#region מחלקת לייק ודיסלייק
class CommentLike(BaseModel):
    """מודל לייק/דיסלייק לתגובות - מעקב אחרי תגובות משתמשים על תגובות"""
    __tablename__ = 'comment_likes'

    id = db.Column(db.Integer, primary_key=True)
    comment_id = db.Column(db.Integer, db.ForeignKey('comments.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    is_like = db.Column(db.Boolean, nullable=False)  # True = לייק, False = דיסלייק
    created_at = db.Column(db.DateTime, default=lambda: datetime.now())

    __table_args__ = (
        db.UniqueConstraint('user_id', 'comment_id', name='unique_user_comment_like'),
    )
# endregion
#endregion