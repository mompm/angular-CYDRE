from sqlalchemy import create_engine, MetaData, Table
from sqlalchemy.orm import sessionmaker
from api import Users  
from werkzeug.security import generate_password_hash, check_password_hash


# Configuration de la base de données
DATABASE_URI = 'mysql+pymysql://root:diverse35@localhost/cydre'

# Création de l'engine
engine = create_engine(DATABASE_URI)
Session = sessionmaker(bind=engine)
session = Session()

# Supprimer toutes les entrées de la table users
session.query(Users).delete()

# Ajouter un utilisateur administrateur par défaut
admin_user = Users(username='diverse',password=generate_password_hash('diverse35'), role='dev')

session.add(admin_user)

# Valider les modifications
session.commit()

print("La base de données a été réinitialisée avec un utilisateur admin par défaut.")
