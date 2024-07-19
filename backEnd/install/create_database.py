# -*- coding: utf-8 -*-
"""
Created on Thu Jul 18 14:44:01 2024

@author: Nicolas Cornette
"""

import mysql.connector
from mysql.connector import errorcode

# Informations de connexion
config = {
    'user': 'root',
    'password': 'diverse35',  # Remplacez par votre mot de passe MySQL
    'host': '127.0.0.1',
}

# Connexion à MySQL
try:
    cnx = mysql.connector.connect(**config)
    cursor = cnx.cursor()
    print("Connexion réussie à MySQL")
except mysql.connector.Error as err:
    if err.errno == errorcode.ER_ACCESS_DENIED_ERROR:
        print("Erreur de connexion : nom d'utilisateur ou mot de passe incorrect")
    else:
        print(err)
    exit(1)

# Création de la base de données
try:
    cursor.execute("CREATE DATABASE IF NOT EXISTS cydre")
    print("Base de données 'cydre' créée avec succès")
except mysql.connector.Error as err:
    print(f"Erreur lors de la création de la base de données : {err}")
    exit(1)

# Sélection de la base de données
try:
    cursor.execute("USE cydre")
except mysql.connector.Error as err:
    print(f"Erreur lors de la sélection de la base de données : {err}")
    exit(1)

# Création des tables
TABLES = {}

TABLES['Users'] = (
    "CREATE TABLE IF NOT EXISTS Users ("
    "id INT AUTO_INCREMENT PRIMARY KEY,"
    "username VARCHAR(255) NOT NULL UNIQUE,"
    "password VARCHAR(255) NOT NULL,"
    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
    "role ENUM('acteur de l''eau', 'scientifique', 'dev') NOT NULL)"
)

TABLES['Simulations'] = (
    "CREATE TABLE IF NOT EXISTS Simulations ("
    "SimulationID CHAR(36) PRIMARY KEY,"
    "UserID INT,"
    "Parameters JSON,"
    "Results JSON,"
    "Indicators JSON,"
    "SimulationDate DATETIME,"
    "FOREIGN KEY (UserID) REFERENCES Users(id))"
)

TABLES['SimulationsBeta'] = (
    "CREATE TABLE IF NOT EXISTS SimulationsBeta ("
    "SimulationID CHAR(36) PRIMARY KEY,"
    "Parameters JSON,"
    "Results JSON,"
    "Indicators JSON,"
    "SimulationDate DATETIME)"
)

for table_name in TABLES:
    table_description = TABLES[table_name]
    try:
        print(f"Création de la table {table_name} : ", end='')
        cursor.execute(table_description)
        print("OK")
    except mysql.connector.Error as err:
        print(f"Erreur : {err.msg}")
    else:
        print(f"Table {table_name} créée avec succès")

# Insertion de l'utilisateur par défaut
try:
    cursor.execute(
        "INSERT INTO Users (id, username, password, role) "
        "VALUES (0, 'Default', 'default', 'acteur de l''eau')"
    )
    cnx.commit()
    print("Utilisateur par défaut inséré avec succès")
except mysql.connector.Error as err:
    print(f"Erreur lors de l'insertion de l'utilisateur par défaut : {err}")


# Insertion de l'utilisateur admin
try:
    cursor.execute(
        "INSERT INTO Users (username, password, role) "
        "VALUES ('diverse', 'diverse35', 'dev')"
    )
    cnx.commit()
    print("Utilisateur admin inséré avec succès")
except mysql.connector.Error as err:
    print(f"Erreur lors de l'insertion de l'utilisateur admin : {err}")


# Fermeture du curseur et de la connexion
cursor.close()
cnx.close()
print("Connexion à MySQL fermée")