from __future__ import annotations

import os
import json
import uuid
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from PIL import Image, ImageEnhance
from functools import wraps
from models import db, User, Recipe, IngredientEntry, Rating, Favorite, Comment, CommentLike
from flask_cors import CORS

# region שרת והגדרות
app = Flask(__name__)
CORS(app)
# הגדרות חיבור למסד הנתונים ותיקיית העלאות
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///recipes.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'static/uploads'

db.init_app(app)

# יצירת סביבת העבודה: תיקיות וטבלאות במידה ואינן קיימות
with app.app_context():
    if not os.path.exists(app.config['UPLOAD_FOLDER']):
        os.makedirs(app.config['UPLOAD_FOLDER'])
    db.create_all()
    print("הדאטה-בייס והטבלאות מוכנים!")
# endregion

# region פונקציית עזר לעיבוד תמונה (Pillow)
def create_image_variations(original_path):
    """
    מנוע עיבוד תמונה - מייצר 3 וריאציות: שחור-לבן, פילטר חם וזום.
    מספק חוויית משתמש עשירה יותר על ידי הצגת זוויות שונות של המתכון.
    """
    variations = []
    img = Image.open(original_path)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    base_name = os.path.basename(original_path).split('.')[0]
    folder = os.path.dirname(original_path)

    # 1. וריאציית שחור לבן
    bw_path = os.path.join(folder, f"{base_name}_bw.jpg")
    img.convert('L').save(bw_path, quality=90)
    variations.append(bw_path)

    # 2. וריאציית גוון חם (עיבוד צבעים)
    converter = ImageEnhance.Color(img)
    warm_img = converter.enhance(1.8)
    r, g, b = warm_img.split()
    r = r.point(lambda i: i * 1.1)
    warm_img = Image.merge('RGB', (r, g, b))
    warm_path = os.path.join(folder, f"{base_name}_warm.jpg")
    warm_img.save(warm_path, quality=90)
    variations.append(warm_path)

    # 3. וריאציית תקריב (Crop & Resize)
    width, height = img.size
    left, top, right, bottom = width * 0.15, height * 0.15, width * 0.85, height * 0.85
    zoom_img = img.crop((left, top, right, bottom)).resize((width, height), Image.Resampling.LANCZOS)
    zoom_path = os.path.join(folder, f"{base_name}_zoom.jpg")
    zoom_img.save(zoom_path, quality=90)
    variations.append(zoom_path)

    return variations
# endregion

# region דקורטור כללי - בדיקת הרשאות
def role_required(allowed_roles):
    """שומר סף אבטחתי - בודק שלמשתמש יש הרשאה לבצע פעולות רגישות"""

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_id = request.form.get('user_id') or (request.get_json(silent=True) or {}).get('user_id')
            if not user_id:
                user_id = request.args.get('user_id')

            if not user_id:
                return jsonify({"message": "Missing user_id"}), 400

            user = db.session.get(User, user_id)
            if not user:
                return jsonify({"message": "User not found"}), 404

            if user.role not in allowed_roles:
                return jsonify({"message": "Access denied"}), 403

            if user.role == 'Uploader' and not user.is_approved_uploader:
                return jsonify({"message": "Uploader not approved"}), 403

            return f(*args, **kwargs)

        return decorated_function

    return decorator
# endregion

# region אימות משתמש
# region הרשמה
@app.route('/register', methods=['POST'])
def register():
    """הרשמת משתמש חדש עם שם, אימייל וסיסמה מאובטחת ושמירה דרך המודל"""
    data = request.get_json()

    # קבלת הנתונים מהבקשה
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')

    # בדיקה שהשם לא ריק
    if not name:
        return jsonify({"message": "Name is required"}), 400

    if not email:
        return jsonify({"message": "Email is required"}), 400

    if not password:
        return jsonify({"message": "Password is required"}), 400

    #  בדיקה אם המשתמש כבר קיים - לפני יצירת המשתמש לפי המייל כי מייל אי אפשר פעמיים!
    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return jsonify({"message": "Email already registered"}), 400

    # יצירת משתמש חדש עם שם
    new_user = User(name=name, email=email)
    # גיבוב הסיסמה לפני השמירה
    new_user.set_password(password)

    try:
        new_user.save()
        # החזרת המשתמש - כמו login!
        return jsonify({
            "message": "User registered successfully!",
            "user": {
                "id": new_user.id,
                "name": new_user.name,
                "email": new_user.email,
                "role": new_user.role,
                "is_approved_uploader": new_user.is_approved_uploader,
                "was_rejected": new_user.was_rejected
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Registration failed: {str(e)}"}), 500
# endregion

# region כניסה
@app.route('/login', methods=['POST'])
def login():
    """אימות משתמש מול מסד הנתונים באמצעות בדיקת גיבוב והחזרת פרטיו כולל השם"""
    data = request.get_json()
    user = User.query.filter_by(email=data.get('email')).first()
    if user and user.check_password(data.get('password')):
        return jsonify({
            "message": "Login successful!",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role,
                "bio": user.bio,
                "is_approved_uploader": user.is_approved_uploader,
                "was_rejected": user.was_rejected
            }
        }), 200
    return jsonify({"message": "Invalid credentials"}), 401
# endregion
#endregion

# region ניהול פרטי משתמש
# region קבלת פרטי משתמש
@app.route('/user/<int:user_id>', methods=['GET'])
def get_user(user_id):
    """קבלת פרטי משתמש לפי ID - לבדיקת סטטוס עדכני"""
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404

    return jsonify({
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "is_approved_uploader": user.is_approved_uploader,
        "was_rejected": user.was_rejected
    }), 200
# endregion

# region מתכונים של משתמש
@app.route('/user/<int:user_id>/recipes', methods=['GET'])
def get_user_recipes(user_id):
    """קבלת כל המתכונים של משתמש מסוים"""
    recipes = Recipe.query.filter_by(user_id=user_id).all()

    result = []
    for r in recipes:
        result.append({
            "id": r.id,
            "name": r.name,
            "image_path": r.image_path,
            "type": r.type,
            "category": r.category,
            "preparation_time": r.preparation_time,
            "rating": r.rating,
            "rating_count": r.rating_count,
            "created_at": r.created_at.isoformat() if hasattr(r, 'created_at') else None
        })

    return jsonify(result), 200
#endregion

# region פרופיל ציבורי
@app.route('/user/<int:user_id>/profile', methods=['GET'])
def get_public_profile(user_id):
    """קבלת פרופיל ציבורי של משתמש"""
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    viewer_id = request.args.get('viewer_id')

    # עדכון מונה צפיות רק אם הצופה הוא לא הבעלים!
    if viewer_id:
        try:
            viewer_id_int = int(viewer_id)
            if viewer_id_int != user_id:
                user.profile_views += 1
                db.session.commit()
        except ValueError:
            pass  # אם viewer_id לא תקין, פשוט לא סופרים
    else:
        # אם אין viewer_id (משתמש לא מחובר) - סופרים
        user.profile_views += 1
        db.session.commit()

    # קבלת המתכונים של המשתמש
    recipes = Recipe.query.filter_by(user_id=user_id).all()

    recipes_data = []
    for r in recipes:
        recipes_data.append({
            "id": r.id,
            "name": r.name,
            "image_path": r.image_path,
            "type": r.type,
            "category": r.category,
            "preparation_time": r.preparation_time,
            "rating": r.rating,
            "rating_count": r.rating_count
        })

    return jsonify({
        "id": user.id,
        "name": user.name,
        "bio": user.bio,
        "profile_views": user.profile_views,
        "role": user.role,
        "recipes": recipes_data,
        "recipe_count": len(recipes),
        "created_at": user.created_at.isoformat() if hasattr(user, 'created_at') and user.created_at else None
    }), 200
# endregion

# region עדכון ביוגרפיה
@app.route('/user/<int:user_id>/bio', methods=['PUT'])
def update_bio(user_id):
    """עדכון הביוגרפיה של משתמש"""
    data = request.get_json()
    bio = data.get('bio', '')

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    user.bio = bio
    db.session.commit()

    return jsonify({
        "message": "Bio updated successfully",
        "bio": user.bio
    }), 200
# endregion

# region בקשה להרשאות Uploader
@app.route('/user/<int:user_id>/request-uploader', methods=['POST'])
def request_uploader_status(user_id):
    """משתמש שולח בקשה להיות Uploader"""
    data = request.get_json()
    message = data.get('message', '')

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    if user.is_approved_uploader:
        return jsonify({"error": "Already an approved uploader"}), 400

    user.request_message = message
    db.session.commit()

    return jsonify({"message": "Request sent successfully"}), 200
# endregion
#endregion

# region מתכונים
# region קבלת מתכונים (כולל סינונים ומיונים)
@app.route('/recipes', methods=['GET'])
def get_recipes():
    """
    שליפת כל המתכונים מהגלריה.
    תומך בסינון לפי קטגוריה, כשרות, זמן (מינימלי ומקסימלי), דירוג מינימלי ושם מתכון.
    תומך במיון לפי זמן (מהיר לארוך) או דירוג (גבוה לנמוך).
    """
    category = request.args.get('category')  # סינון: קטגוריה
    recipe_type = request.args.get('type')  # סינון: חלבי/בשרי/פרווה (כשרות)
    min_time = request.args.get('min_time')  # סינון: זמן הכנה מינימלי
    max_time = request.args.get('max_time')  # סינון: זמן הכנה מקסימלי
    min_rating = request.args.get('min_rating')  # סינון: דירוג מינימלי
    sort_by = request.args.get('sort')  # מיון: 'time' או 'rating'
    name = request.args.get('name')  # 🔥 חיפוש: שם מתכון

    query = Recipe.query

    # --- סינון (Filtering) ---
    if category:
        query = query.filter_by(category=category)
    if recipe_type:
        query = query.filter_by(type=recipe_type)
    if min_time:
        query = query.filter(Recipe.preparation_time >= int(min_time))
    if max_time:
        query = query.filter(Recipe.preparation_time <= int(max_time))
    if min_rating:
        query = query.filter(Recipe.rating >= float(min_rating))
    if name:
        query = query.filter(Recipe.name.ilike(f'%{name}%'))

    # --- מיון (Sorting) ---
    if sort_by == 'time':
        query = query.order_by(Recipe.preparation_time.asc())
    elif sort_by == 'rating':
        query = query.order_by(Recipe.rating.desc())

    recipes = query.all()

    # הסבה לפורמט JSON עם רכיבים מלאים
    output = []
    for r in recipes:
        output.append({
            "id": r.id,
            "name": r.name,
            "image_path": r.image_path,
            "type": r.type,
            "category": r.category,
            "preparation_time": r.preparation_time,
            "instructions": r.instructions,
            "steps": r.steps,
            "rating": r.rating,
            "rating_count": r.rating_count,
            "ingredients": [{"product": i.product, "amount": i.amount, "unit": i.unit} for i in r.ingredients]
        })
    return jsonify(output), 200
#endregion

# region פרטי מתכון
@app.route('/recipes/<int:recipe_id>', methods=['GET'])
def get_single_recipe(recipe_id):
    """דף מתכון יחיד - הצגה מלאה של כל פרטי המתכון"""
    r = db.session.get(Recipe, recipe_id)
    if not r:
        return jsonify({"message": "Recipe not found"}), 404

    uploader_data = None
    if r.uploader:
        uploader_data = {
            "id": r.uploader.id,
            "name": r.uploader.name,
            "bio": r.uploader.bio if hasattr(r.uploader, 'bio') else ""
        }

    recipe_data = {
        "id": r.id,
        "name": r.name,
        "image_path": r.image_path,
        "variation_paths": json.loads(r.variation_paths) if r.variation_paths else [],
        "type": r.type,
        "category": r.category,
        "preparation_time": r.preparation_time,
        "instructions": r.instructions,  # ✅ תאימות אחורה
        "steps": r.steps,  # ✅ שלבים חדשים
        "rating": r.rating,
        "rating_count": r.rating_count,
        "ingredients": [{"product": i.product, "amount": i.amount, "unit": i.unit} for i in r.ingredients],
        "uploader": uploader_data
    }
    return jsonify(recipe_data), 200
# endregion

# region עדכון דירוג
@app.route('/recipes/<int:recipe_id>/rate', methods=['PUT'])
def rate_recipe(recipe_id):
    """
    עדכון הדירוג של המתכון על ידי המשתמשים.
    שומר כל דירוג בטבלה נפרדת ומחשב ממוצע אמיתי.
    תומך בדירוגים שלמים בלבד

    זרימת העבודה:
    1. משתמש שולח דירוג- בודקים אם המשתמש כבר דירג (עדכון)
    2. מחשבים ממוצע מכל הדירוגים בטבלה- Rating שומרים בטבלת
    3. מעדכנים את recipe.rating ו-recipe.rating_count
    """
    data = request.get_json()
    new_rating = float(data.get('rating'))
    user_id = data.get('user_id', 1)  # ברירת מחדל למשתמש 1

    # עיגול לחצי הקרוב
    new_rating = round(new_rating * 2) / 2

    # וולידציה
    if new_rating < 1 or new_rating > 5:
        return jsonify({"message": "Rating must be between 0.5 and 5.0"}), 400

    # חיפוש מתכון
    recipe = db.session.get(Recipe, recipe_id)
    if not recipe:
        return jsonify({"message": "Recipe not found"}), 404

    # חיפוש דירוג קיים של המשתמש למתכון זה
    existing_rating = Rating.query.filter_by(recipe_id=recipe_id, user_id=user_id).first()

    if existing_rating:
        # עדכון דירוג קיים
        existing_rating.score = new_rating
        db.session.commit()
    else:
        # יצירת דירוג חדש
        rating_entry = Rating(recipe_id=recipe_id, user_id=user_id, score=new_rating)
        rating_entry.save()

    # חישוב ממוצע אמיתי מכל הדירוגים
    all_ratings = Rating.query.filter_by(recipe_id=recipe_id).all()
    total_score = sum(r.score for r in all_ratings)
    count = len(all_ratings)
    avg = total_score / count if count > 0 else 0


    # עדכון המתכון
    recipe.rating = round(avg, 1)
    recipe.rating_count = count
    db.session.commit()

    return jsonify({
        "message": "Rating updated!",
        "new_average": recipe.rating,
        "total_ratings": recipe.rating_count
    }), 200
# endregion

# region העלאת מתכון
@app.route('/recipes', methods=['POST'])
@role_required(['Admin', 'Uploader'])
def add_recipe():
    """העלאת מתכון חדש: שמירת תמונה, עיבוד וריאציות, שמירת רכיבים והוראות הכנה"""

    recipe_name = request.form.get('name')
    recipe_type = request.form.get('type')
    recipe_category = request.form.get('category')
    prep_time = request.form.get('preparation_time')
    instructions = request.form.get('instructions')
    steps_json = request.form.get('steps')
    ingredients_json = request.form.get('ingredients')
    user_id = request.form.get('user_id')

    if not recipe_name:
        return jsonify({"error": "Missing recipe name"}), 400
    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400

    if 'image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files['image']
    filename = f"{uuid.uuid4()}_{secure_filename(file.filename)}"
    original_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(original_path)

    v_paths = create_image_variations(original_path)

    # טיפול בשלבים
    steps_data = None
    if steps_json:
        try:
            steps_data = json.loads(steps_json)
        except:
            steps_data = None

    new_recipe = Recipe(
        name=recipe_name,
        image_path=original_path,
        variation_paths=json.dumps(v_paths),
        type=recipe_type,
        category=recipe_category,
        preparation_time=prep_time,
        user_id=user_id,
        instructions=instructions,  # ✅ תאימות אחורה
        steps=steps_data,  # ✅ שלבים חדשים
        rating=0.0,
        rating_count=0
    )

    new_recipe.save()

    if ingredients_json:
        try:
            items = json.loads(ingredients_json)
            for item in items:
                new_ing = IngredientEntry(
                    product=item.get('product'),
                    amount=item.get('amount'),
                    unit=item.get('unit'),
                    recipe_id=new_recipe.id
                )
                new_ing.save()

            # עדכון cache של רכיבים
            new_recipe.ingredients_cache = [item.get('product') for item in items]
            db.session.commit()

        except Exception as e:
            print(f"Error parsing ingredients: {e}")

    return jsonify({"message": "Recipe created!", "id": new_recipe.id}), 201
# endregion

# region עדכון מתכון
@app.route('/recipes/<int:recipe_id>', methods=['PUT'])
def update_recipe(recipe_id):
    """עדכון מתכון קיים"""
    try:
        recipe = db.session.get(Recipe, recipe_id)
        if not recipe:
            return jsonify({"error": "Recipe not found"}), 404

        # בדיקת בעלות - רק הבעלים של המתכון או מנהל יכולים לעדכן
        user_id = request.form.get('user_id')
        if not user_id:
            return jsonify({"error": "Missing user_id"}), 400
        user = db.session.get(User, int(user_id))
        if not user or (user.role != 'Admin' and recipe.user_id != int(user_id)):
            return jsonify({"error": "Access denied"}), 403

        # עדכון שדות
        if 'name' in request.form:
            recipe.name = request.form['name']
        if 'type' in request.form:
            recipe.type = request.form['type']
        if 'category' in request.form:
            recipe.category = request.form['category']
        if 'preparation_time' in request.form:
            recipe.preparation_time = int(request.form['preparation_time'])
        if 'instructions' in request.form:
            recipe.instructions = request.form['instructions']

        # עדכון שלבים
        if 'steps' in request.form:
            try:
                recipe.steps = json.loads(request.form['steps'])
            except:
                recipe.steps = None

        # עדכון רכיבים
        if 'ingredients' in request.form:
            # מחיקת רכיבים ישנים
            IngredientEntry.query.filter_by(recipe_id=recipe_id).delete()

            # הוספת רכיבים חדשים
            ingredients_data = json.loads(request.form['ingredients'])
            for ing in ingredients_data:
                new_ing = IngredientEntry(
                    recipe_id=recipe_id,
                    product=ing['product'],
                    amount=ing['amount'],
                    unit=ing['unit']
                )
                db.session.add(new_ing)

            # עדכון cache
            recipe.ingredients_cache = [ing['product'] for ing in ingredients_data]

        # עדכון תמונה (אם הועלתה תמונה חדשה)
        if 'image' in request.files:
            file = request.files['image']
            if file and file.filename:
                # מחיקת תמונות ישנות
                if recipe.image_path and os.path.exists(recipe.image_path):
                    os.remove(recipe.image_path)
                if recipe.variation_paths:
                    for var_path in json.loads(recipe.variation_paths):
                        if os.path.exists(var_path):
                            os.remove(var_path)

                # שמירת תמונה חדשה
                filename = secure_filename(file.filename)
                unique_filename = f"{uuid.uuid4().hex}_{filename}"
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
                file.save(filepath)

                recipe.image_path = filepath

                # יצירת וריאציות
                variations = create_image_variations(filepath)
                recipe.variation_paths = json.dumps(variations)

        db.session.commit()

        return jsonify({
            "message": "Recipe updated successfully",
            "recipe": {
                "id": recipe.id,
                "name": recipe.name,
                "category": recipe.category
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
#endregion

# region מחיקת מתכון
@app.route('/recipes/<int:recipe_id>', methods=['DELETE'])
def delete_recipe(recipe_id):
    """ יכול למחוק Admin מחיקת מתכון - רק"""
    try:
        # קבלת user_id מהquery parameters
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({"error": "Missing user_id"}), 400

        # בדיקת הרשאות
        user = db.session.get(User, user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        if user.role != 'Admin':
            return jsonify({"error": "Only Admin can delete recipes"}), 403

        # מחיקת המתכון
        recipe = db.session.get(Recipe, recipe_id)
        if not recipe:
            return jsonify({"error": "Recipe not found"}), 404

        # מחיקת תמונות מהדיסק
        if recipe.image_path and os.path.exists(recipe.image_path):
            try:
                os.remove(recipe.image_path)
            except:
                pass

        if recipe.variation_paths:
            try:
                variations = json.loads(recipe.variation_paths)
                for var_path in variations:
                    if os.path.exists(var_path):
                        os.remove(var_path)
            except:
                pass

        # מחיקת המתכון מהDB (cascade ידאג לרכיבים, דירוגים וכו')
        db.session.delete(recipe)
        db.session.commit()

        return jsonify({"message": "Recipe deleted successfully"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
# endregion

# region חיפוש חכם לפי רכיבים
@app.route('/recipes/search', methods=['POST'])
def search_recipes_by_ingredients():
    """חיפוש מבוסס רכיבים המחשב אחוזי התאמה לפי מה שיש למשתמש בבית"""
    data = request.get_json()
    user_ingredients = set(data.get('my_ingredients', []))
    all_recipes = Recipe.query.all()
    results = []
    for r in all_recipes:
        # שימוש ב-cache (או fallback לרכיבים רגילים)
        recipe_ing_names = set(r.ingredients_cache or [ing.product for ing in r.ingredients])
        common = user_ingredients & recipe_ing_names
        if recipe_ing_names and len(common) > 0:
            score = (len(common) / len(recipe_ing_names)) * 100
            results.append({
                "id": r.id,
                "name": r.name,
                "match_score": round(score, 1),
                "image_path": r.image_path,
                "type": r.type,
                "category": r.category,
                "preparation_time": r.preparation_time,
                "rating": r.rating,
                "missing_count": len(recipe_ing_names - user_ingredients)
            })
    results.sort(key=lambda x: x['match_score'], reverse=True)
    return jsonify(results), 200
# endregion
#endregion

# region תגובות למתכונים
@app.route('/recipes/<int:recipe_id>/comments', methods=['GET'])
def get_recipe_comments(recipe_id):
    """קבלת כל התגובות על מתכון"""
    comments = Comment.query.filter_by(recipe_id=recipe_id).order_by(Comment.created_at.desc()).all()

    result = []
    for c in comments:
        # ספירת לייקים ודיסלייקים
        likes_count = CommentLike.query.filter_by(comment_id=c.id, is_like=True).count()
        dislikes_count = CommentLike.query.filter_by(comment_id=c.id, is_like=False).count()

        result.append({
            "id": c.id,
            "text": c.text,
            "created_at": c.created_at.isoformat(),
            "user_id": c.user.id,
            "user_name": c.user.name,
            "likes_count": likes_count,
            "dislikes_count": dislikes_count
        })

    return jsonify(result), 200

#region הוספת תגובה
@app.route('/recipes/<int:recipe_id>/comments', methods=['POST'])
def add_comment(recipe_id):
    """הוספת תגובה למתכון"""
    data = request.get_json()
    user_id = data.get('user_id')
    text = data.get('text')

    if not user_id or not text:
        return jsonify({"error": "Missing user_id or text"}), 400

    # בדיקת משתמש
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    # בדיקת מתכון
    recipe = db.session.get(Recipe, recipe_id)
    if not recipe:
        return jsonify({"error": "Recipe not found"}), 404

    # יצירת תגובה
    new_comment = Comment(
        recipe_id=recipe_id,
        user_id=user_id,
        text=text
    )
    new_comment.save()

    return jsonify({
        "message": "Comment added successfully",
        "comment": {
            "id": new_comment.id,
            "text": new_comment.text,
            "created_at": new_comment.created_at.isoformat(),
            "user_id": new_comment.user.id,
            "user_name": new_comment.user.name,
            "likes_count": 0,
            "dislikes_count": 0
        }
    }), 201
#endregion
#region מחיקת תגובה
@app.route('/comments/<int:comment_id>', methods=['DELETE'])
def delete_comment(comment_id):
    """מחיקת תגובה"""
    user_id = request.args.get('user_id')

    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400

    comment = db.session.get(Comment, comment_id)
    if not comment:
        return jsonify({"error": "Comment not found"}), 404

    # ודא שהמשתמש הוא בעל התגובה או Admin
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    if comment.user_id != int(user_id) and user.role != 'Admin':
        return jsonify({"error": "Unauthorized"}), 403

    db.session.delete(comment)
    db.session.commit()

    return jsonify({"message": "Comment deleted successfully"}), 200
#endregion
#region לייק ודיסלייק
@app.route('/comments/<int:comment_id>/like', methods=['POST'])
def toggle_comment_like(comment_id):
    """הוספה/הסרה/שינוי לייק או דיסלייק לתגובה"""
    data = request.get_json()
    user_id = data.get('user_id')
    is_like = data.get('is_like')  # True = לייק, False = דיסלייק

    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400

    if is_like is None:
        return jsonify({"error": "Missing is_like parameter"}), 400

    # בדיקת משתמש וקיום תגובה
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    comment = db.session.get(Comment, comment_id)
    if not comment:
        return jsonify({"error": "Comment not found"}), 404

    # אדם לא יכול לעשות לייק/דיסלייק לעצמו
    if comment.user_id == user_id:
        return jsonify({"error": "You cannot like or dislike your own comment"}), 400

    # חיפוש לייק קיים
    existing_like = CommentLike.query.filter_by(
        comment_id=comment_id,
        user_id=user_id
    ).first()

    if existing_like:
        # אם הלייק זהה - מחיקה (ביטול)
        if existing_like.is_like == is_like:
            db.session.delete(existing_like)
            db.session.commit()

            # ספירה מחדש
            likes_count = CommentLike.query.filter_by(comment_id=comment_id, is_like=True).count()
            dislikes_count = CommentLike.query.filter_by(comment_id=comment_id, is_like=False).count()

            return jsonify({
                "message": "Like removed",
                "likes_count": likes_count,
                "dislikes_count": dislikes_count,
                "user_reaction": None
            }), 200
        else:
            # אם שונה - עדכון
            existing_like.is_like = is_like
            db.session.commit()

            # ספירה מחדש
            likes_count = CommentLike.query.filter_by(comment_id=comment_id, is_like=True).count()
            dislikes_count = CommentLike.query.filter_by(comment_id=comment_id, is_like=False).count()

            return jsonify({
                "message": "Like updated",
                "likes_count": likes_count,
                "dislikes_count": dislikes_count,
                "user_reaction": "like" if is_like else "dislike"
            }), 200
    else:
        # יצירת לייק חדש
        new_like = CommentLike(
            comment_id=comment_id,
            user_id=user_id,
            is_like=is_like
        )
        new_like.save()

        # ספירה מחדש
        likes_count = CommentLike.query.filter_by(comment_id=comment_id, is_like=True).count()
        dislikes_count = CommentLike.query.filter_by(comment_id=comment_id, is_like=False).count()

        return jsonify({
            "message": "Like added",
            "likes_count": likes_count,
            "dislikes_count": dislikes_count,
            "user_reaction": "like" if is_like else "dislike"
        }), 201

@app.route('/comments/<int:comment_id>/user-reaction/<int:user_id>', methods=['GET'])
def get_user_comment_reaction(comment_id, user_id):
    """בדיקת סטטוס הלייק/דיסלייק של משתמש על תגובה - לצורך הצגת מצב הכפתורים בטעינת הדף"""
    existing_like = CommentLike.query.filter_by(
        comment_id=comment_id,
        user_id=user_id
    ).first()

    if not existing_like:
        return jsonify({"user_reaction": None}), 200

    return jsonify({
        "user_reaction": "like" if existing_like.is_like else "dislike"
    }), 200
#endregion
#endregion

# region מועדפים
@app.route('/recipes/<int:recipe_id>/favorite', methods=['POST'])
def add_favorite(recipe_id):
    """הוספת מתכון למועדפים"""
    data = request.get_json()
    user_id = data.get('user_id')

    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400

    # בדיקה אם כבר במועדפים
    existing = Favorite.query.filter_by(recipe_id=recipe_id, user_id=user_id).first()
    if existing:
        return jsonify({"message": "Already in favorites"}), 200

    new_favorite = Favorite(recipe_id=recipe_id, user_id=user_id)
    new_favorite.save()

    return jsonify({"message": "Added to favorites"}), 201


@app.route('/recipes/<int:recipe_id>/favorite', methods=['DELETE'])
def remove_favorite(recipe_id):
    """הסרת מתכון מהמועדפים"""
    user_id = request.args.get('user_id')

    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400

    favorite = Favorite.query.filter_by(recipe_id=recipe_id, user_id=user_id).first()
    if not favorite:
        return jsonify({"error": "Not in favorites"}), 404

    db.session.delete(favorite)
    db.session.commit()

    return jsonify({"message": "Removed from favorites"}), 200


@app.route('/user/<int:user_id>/favorites', methods=['GET'])
def get_user_favorites(user_id):
    """קבלת כל המתכונים המועדפים של משתמש"""
    favorites = Favorite.query.filter_by(user_id=user_id).all()
    recipe_ids = [f.recipe_id for f in favorites]

    recipes = Recipe.query.filter(Recipe.id.in_(recipe_ids)).all()

    result = []
    for r in recipes:
        result.append({
            "id": r.id,
            "name": r.name,
            "image_path": r.image_path,
            "type": r.type,
            "category": r.category,
            "preparation_time": r.preparation_time,
            "rating": r.rating,
            "rating_count": r.rating_count
        })

    return jsonify(result), 200


@app.route('/recipes/<int:recipe_id>/is_favorite', methods=['GET'])
def is_favorite(recipe_id):
    """בדיקה אם מתכון במועדפים"""
    user_id = request.args.get('user_id')

    if not user_id:
        return jsonify({"is_favorite": False}), 200

    favorite = Favorite.query.filter_by(recipe_id=recipe_id, user_id=user_id).first()
    return jsonify({"is_favorite": favorite is not None}), 200
# endregion

# region אישור/דחייה של בקשות (Admin)
@app.route('/admin/uploader-requests', methods=['GET'])
@role_required(['Admin'])
def get_uploader_requests():
    """קבלת כל בקשות ההרשאות ממתינות"""
    pending_users = User.query.filter(
        User.request_message.isnot(None),
        User.is_approved_uploader == False
    ).all()

    result = []
    for u in pending_users:
        result.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "request_message": u.request_message,
            "was_rejected": u.was_rejected
        })

    return jsonify(result), 200

#אישור
@app.route('/admin/approve-uploader/<int:user_id>', methods=['PUT'])
@role_required(['Admin'])
def approve_uploader(user_id):
    """אישור משתמש כUploader"""
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    user.role = 'Uploader'
    user.is_approved_uploader = True
    user.was_rejected = False
    user.request_message = None
    db.session.commit()

    return jsonify({"message": "User approved as Uploader"}), 200

#דחיה
@app.route('/admin/reject-uploader/<int:user_id>', methods=['PUT'])
@role_required(['Admin'])
def reject_uploader(user_id):
    """דחיית בקשה להיות Uploader"""
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    user.was_rejected = True
    user.request_message = None
    db.session.commit()

    return jsonify({"message": "Request rejected"}), 200
# endregion

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        print("הדאטה-בייס והטבלאות מוכנים!")
    app.run(debug=True)