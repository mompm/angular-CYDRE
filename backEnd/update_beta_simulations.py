import os
import requests
import pandas as pd
import pyproj
from shapely.geometry import Point

# Définir le chemin vers le fichier stations.csv
app_root = os.path.dirname(os.path.abspath(__file__))
stations_file_path = os.path.join(app_root, 'data', 'stations.csv')

# Charger les données des stations
stations = pd.read_csv(stations_file_path, delimiter=';', encoding='ISO-8859-1')

def send_reset_request():
    url = "http://localhost:5000/api/resetDatabase"  # A changer lors de l'utilisation sur le serveur
    headers = {'Content-Type': 'application/json'}
    response = requests.post(url, headers=headers)
    if response.status_code == 200:
        print("Successfully reset the database")
    else:
        print(f"Failed to reset the database: {response.text}")

def send_update_request(station):
    url = "http://localhost:5000/api/updateSimulationsBeta"  #  A changer lors de l'utilisation sur le serveur
    headers = {'Content-Type': 'application/json'}
    data = {"station": station}
    response = requests.post(url, json=data, headers=headers)
    if response.status_code == 200:
        print(f"Successfully updated simulation for station ID: {station}")
    else:
        print(f"Failed to update simulation for station ID: {station}: {response.text}")

def update_database():
    send_reset_request()  # Réinitialiser la base de données avant de la mettre à jour
    for index, station in stations.iterrows():
        send_update_request(station['ID'])

if __name__ == "__main__":
    update_database()
