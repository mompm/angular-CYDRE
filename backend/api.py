# -*- coding: utf-8 -*-
"""
Created on Mon Jul 17 15:35:15 2023

@author: nicol
"""

import csv
import json
import os
import flask 
from flask import jsonify, render_template, request
from flask_cors import CORS, cross_origin
import pyproj
import utils.toolbox as TO
from shapely.geometry import MultiPolygon, Polygon
import geopandas as gpd
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import numpy as np
from shapely.geometry import mapping
from datetime import datetime



chemin_absolu = os.path.abspath("api.py")
app_root = os.path.dirname(chemin_absolu)
out_path = os.path.join(app_root, "outputs")
watersheds = TO.load_object(out_path, 'data.pkl')

stations = pd.read_csv(os.path.join(app_root, 'data', 'stations.csv'), delimiter=';')
piezo_stations = pd.read_csv(os.path.join(app_root, 'data', 'piezometry', 'stations.csv'))

# Noms DREAL des stations hydrologiques
dreal_name = []
dreal_area = []
min_lon = []
min_lat = []
max_lon = []
max_lat = []
#discharges = []
temperatures = [] 
precipitations = []
piezo_table = []
watershed_list = list(watersheds.keys())



for station in watershed_list:
    dreal_name.append(watersheds[station]['hydrometry']['name'])
    dreal_area.append(watersheds[station]['hydrometry']['area'])
    geo = watersheds[station]['geographic']
    geometry = geo['geometry']
    gdf = gpd.GeoDataFrame({'geometry': geometry}, crs='EPSG:2154')
    gdf_wgs84 = gdf.to_crs(epsg=4326) # projection to WGS84
    min_lon.append(gdf_wgs84.bounds.iloc[0]['minx'])
    min_lat.append(gdf_wgs84.bounds.iloc[0]['miny'])
    max_lon.append(gdf_wgs84.bounds.iloc[0]['maxx'])
    max_lat.append(gdf_wgs84.bounds.iloc[0]['maxy'])
    #discharges.append(watersheds[station]['hydrometry']['discharge'])
    temperatures.append(watersheds[station]['climatic']['temperature'])
    precipitations.append(watersheds[station]['climatic']['precipitation'])
    #piezo_table.append(watersheds[station]['piezometry']['water_table_depth'])
    
"""
s = watersheds["J0014010"]['hydrometry']['discharge']
indexes = s.index
data_table = [['date', 'Q']]

for timestamp in indexes:
    timestamp = str(timestamp)
    date_only = timestamp.split()[0]  # Vous pouvez utiliser split pour obtenir uniquement la date
    discharge_value = s.loc[timestamp].item()
    data_table.append([date_only, discharge_value])

print(data_table)
"""
# Dataframe avec ID et nom DREAL
watershed_info = pd.DataFrame({
                                'ID':watershed_list,
                                'Nom':dreal_name,
                                'Area':dreal_area,
                                'min_lon': min_lon ,
                                'min_lat' : min_lat,
                                'max_lon': max_lon ,
                                'max_lat' : max_lat,
                                'temperature': temperatures,
                                'precipitation': precipitations,
                                #'piezo_table': piezo_table
                                })

def create_watershed_geodataframe(watersheds):
    
    geometry = []
    watershed_name = []
    geometry_area = []
    hydro_area = []
    K1 = []
    
    watershed_id = list(watersheds.keys())
    
    
    for ws_id in watersheds.keys():
        
        # Extract the watershed geometry (delineation)
        ws_geometry = watersheds[ws_id]['geographic']['geometry']
        
        # If MultiPolygon we have to extract the widest polygon
        if isinstance(ws_geometry[0], MultiPolygon):
            #print(ws_id)
            multi_polygon = ws_geometry.iloc[0]
            polygons = list(multi_polygon.geoms)
            polygon = polygons[0]
            ws_geometry = gpd.GeoDataFrame({'geometry': [polygon]}, crs=ws_geometry.crs)
            ws_geometry = ws_geometry['geometry']
        
        # Add data
        watershed_name.append(watersheds[ws_id]['hydrometry']['name'])
        geometry_area.append(((watersheds[ws_id]['geographic']['geometry'].area)/1e+6).values[0])
        hydro_area.append(watersheds[ws_id]['hydrometry']['area'])
        
        try:
            K1.append(watersheds[ws_id]['hydraulicprop']['calibrated_params']['k1'])
        except:
            K1.append('NaN')
        
        # Create the watershed geodataframe
        gdf = gpd.GeoDataFrame({'geometry': ws_geometry}, crs='EPSG:2154')
        gdf_wgs84 = gdf.to_crs(epsg=4326)
        geometry.append(gdf_wgs84)
    
    df = pd.DataFrame({'name':watershed_name,
                        'geometry_area':geometry_area,
                        'hydro_area':hydro_area,
                        'K1':K1})
    df.index = watershed_id
    gdf = pd.concat(geometry)
    gdf.index = watershed_id
    merged_df = pd.merge(df, gdf, left_index=True, right_index=True)
    gdf = gpd.GeoDataFrame(merged_df, geometry='geometry')
    return gdf

gdf = create_watershed_geodataframe(watersheds)

app = flask.Flask(__name__)
cors = CORS(app)
app.config['CORS_HEADERS'] = 'Content-Type'




@app.route('/osur/getxmlnames', methods=['GET'])
@cross_origin()
def xmlList():
    return flask.jsonify(["cydre_inputs", "PARADIS_inputs"])

@app.route('/osur/getxml/PARADIS_inputs', methods=['GET'])
@cross_origin()
def paradis():
    xmlPath="PARADIS_A14_TRANSITION_MATRICE_1000.xml"
    return flask.send_file(xmlPath, mimetype='application/xml')

@app.route('/osur/getxml/cydre_inputs', methods=['GET'])
@cross_origin()
def cydre():
    xmlPath="cydre_params.xml"
    return flask.send_file(xmlPath, mimetype='application/xml')

@app.route('/osur/run_cydre', methods=['POST'])
@cross_origin()
def run_cydre():
    data = flask.request.get_data()
    print(data.decode())
    return flask.jsonify("all good")

# Définition de la route pour récupérer les données du fichier CSV
@app.route('/osur/getCoordinates', methods=['GET'])
@cross_origin()
def get_coordinates():
    # We don't use this one yet
    request_id = flask.request.args.get('ID')

    json_list = []

    with open("data/map.csv", 'r') as csv_file:
        # Attention faire attention au delimiter (sinon y a un erreur)
        csv_reader = csv.DictReader(csv_file, delimiter=';')

        for row in csv_reader:
            json_object = {
                'name': row['name'],
                'ID': row['ID'],
                'x_outlet': row['x_outlet'],
                'y_outlet': row['y_outlet'],
                'Area': row['Area']
            }
            json_list.append(json_object)

    return json_list

@app.route('/osur/getoldBSS', methods=['GET'])
@cross_origin()
def get_oldBSS():
   # We don't use this one yet
    request_id = flask.request.args.get('ID')

    json_list = []

    with open("data/piezometry/stations.csv", 'r') as csv_file:
        # Attention faire attention au delimiter (sinon y a un erreur)
        csv_reader = csv.DictReader(csv_file, delimiter=',')
        for row in csv_reader:
            json_object = {
                'X_WGS84': row['X_WGS84'],
                'Y_WGS84': row['Y_WGS84'],
                'Identifiant_BSS': row['Identifiant BSS'],
                'Ancien_code_national_BSS': row['Ancien code national BSS']
            }
            json_list.append(json_object)

    return json_list


@app.route('/osur/getcorrespondanceBSS', methods=['GET'])
@cross_origin()
def get_correspondanceBSS():
   # We don't use this one yet
    request_id = flask.request.args.get('ID')

    json_list = []

    with open("data/piezometry/correspondance_watershed_piezometers.csv", 'r') as csv_file:
        # Attention faire attention au delimiter (sinon y a un erreur)
        csv_reader = csv.DictReader(csv_file, delimiter=';')
        for row in csv_reader:
            json_object = {
                'NOM_BV': row['NOM_BV'],
                'ID_HYDRO': row['ID_HYDRO'],
                'CODE_BSS': row['CODE_BSS'],
                'TEMPS_RECESS': row['TEMPS_RECESS']
            }
            json_list.append(json_object)
    return json_list



@app.route('/osur/getdatagdf', methods=['GET'])
@cross_origin()
def get_cydreapp_gdf():
    # Liste pour stocker les objets JSON
    json_list = []
    
    # Itérer sur chaque élément du GeoDataFrame
    for index, row in gdf.iterrows():
        # Convertir la géométrie en GeoJSON
        geometry_geojson = mapping(row.geometry)
        k1_value = row['K1']
        if isinstance(k1_value, str) and k1_value== 'NaN':
            k1_value = float(0)        
        else:
            k1_value = float(k1_value)
        # Créer un objet JSON pour chaque élément
        json_object = {
            'index': index,
            'name': row['name'],
            'geometry_area': float(row['geometry_area']),  # Convertir en float si nécessaire
            'hydro_area': row['hydro_area'],
            'K1': k1_value,  # Convertir en float si nécessaire
            'geometry': geometry_geojson  # Géométrie au format GeoJSON
        }
        
        # Ajouter l'objet JSON à la liste
        json_list.append(json_object)
    
    # Convertir la liste de JSON en format JSON
    json_data = json.dumps(json_list)
    
    return json_data

@app.route('/osur/getdff', methods=['GET'])
@cross_origin()
def get_dff_info():
    # Fonction pour convertir les coordonnées en Lambert 93 vers WGS84
    lambert93_to_wgs84 = pyproj.Transformer.from_crs("EPSG:2154", "EPSG:4326", always_xy=True)
    dff = stations
    merged_df = dff.merge(watershed_info, on='ID', how='inner')
    merged_df['name'] = merged_df['Nom']
    merged_df.drop('Nom', axis=1, inplace=True)
    dff = merged_df
    x_wgs84, y_wgs84 = lambert93_to_wgs84.transform(dff["x_outlet"], dff["y_outlet"])

    dff_json = []
    for index, row in dff.iterrows():
        json_object = {
            'index': row['ID'],
            'name': row['name'],
            'area': float(row['Area']),  # Convertir en float si nécessaire
            'x_wgs84': x_wgs84[index],
            'y_wgs84': y_wgs84[index],
            'min_lon':row['min_lon'],
            'min_lat':row['min_lat'],
            'max_lon':row['max_lon'],
            'max_lat':row['max_lat'],
        }
        dff_json.append(json_object)

    return json.dumps(dff_json)


@app.route('/osur/getCoordpiezo', methods=['GET'])
@cross_origin()
def get_piezo_Coords():
    json_list = []

    for index, row in piezo_stations.iterrows():
        # Crée un objet JSON avec les données de la ligne
        json_object = {
            'identifiant_BSS' : row['Identifiant BSS'],
            'x_wgs84':row['X_WGS84'],
            'y_wgs84':row['Y_WGS84']
        }
        json_list.append(json_object)
    
    return json_list


# Chemin vers le répertoire contenant les fichiers CSV
hydrology_path = os.path.join(app_root,'data', 'hydrology')

@app.route('/osur/stationDischarge/<string:id>', methods=['GET'])
@cross_origin()
def get_stationdata(id):
    if id is not None:
        # Nom du fichier CSV basé sur l'identifiant
        csv_filename = f'{id}.csv'
        # Chemin complet vers le fichier CSV
        csv_file_path = os.path.join(hydrology_path, csv_filename)
        # Vérifier si le fichier CSV existe
        if os.path.exists(csv_file_path):
            # Initialiser une liste pour stocker les données JSON
            id_upper = id.upper()
            station_name = watersheds[id_upper]['hydrometry']['name']
            json_list = []
            json_list.append(station_name)
            # Ouvrir le fichier CSV
            with open(csv_file_path, 'r', encoding='utf-8') as csv_file:
                # Attention au delimiter (si nécessaire)
                csv_reader = csv.DictReader(csv_file)
                # Parcourir les lignes du fichier CSV
                for row in csv_reader:
                    # Créer un dictionnaire JSON pour chaque ligne
                    json_object = {
                        't': row['t'],
                        'Q': row['Q']
                    }
                    # Ajouter le dictionnaire à la liste
                    json_list.append(json_object)
            # Retourner la liste JSON
            return jsonify(json_list), 200
        else:
            return jsonify({"filename": csv_filename,}), 404
    else:
        return jsonify({"error": "Identifiant non fourni"}), 404

if __name__ == '__main__':
    app.run(host='localhost')
