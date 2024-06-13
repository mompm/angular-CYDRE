import json
import uuid
import flask
from flask import jsonify, request
from flask_cors import CORS, cross_origin
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, current_user, login_user, logout_user, login_required
from sqlalchemy.orm.attributes import flag_modified

import numpy as np
from sqlalchemy.ext.declarative import declarative_base


from sqlalchemy import JSON, Column, DateTime, Integer, String, func, text, update
from werkzeug.security import generate_password_hash, check_password_hash

import os,csv 

import pandas as pd
import geopandas as gpd
import pyproj
from shapely.geometry import mapping , Point

import libraries.forecast.initialization as INI
import libraries.forecast.outputs as OU
import plotly.graph_objects as go



# Configuration
app = flask.Flask(__name__)
CORS(app, supports_credentials=True, origins=["http://localhost:4200", "https://apirequest.io"])
app.config['CORS_HEADERS'] = 'Content-Type'
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:diverse35@localhost/cydre'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'une_cle_secrete_tres_complexe'

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)

# Application path
app_root = os.path.dirname(os.path.abspath("api.py"))

hydrometry_path = os.path.join(app_root,'data', 'hydrometry')
surfex_path = os.path.join(app_root, 'data', 'climatic', 'surfex')
piezometry_path = os.path.join(app_root, 'data', 'piezometry')
# -- Read hydrological and piezometric stations csv files and watersheds boundaries

# Hydrological stations
stations = pd.read_csv(os.path.join(app_root, 'data', 'stations.csv'), delimiter=';', encoding='ISO-8859-1')
lambert93_to_wgs84 = pyproj.Transformer.from_crs("EPSG:2154", "EPSG:4326", always_xy=True)
x_wgs84, y_wgs84 = lambert93_to_wgs84.transform(stations["x_outlet"], stations["y_outlet"])
geometry_stations = [Point(xy) for xy in zip(x_wgs84, y_wgs84)]
gdf_stations = gpd.GeoDataFrame(stations, geometry=geometry_stations, crs="EPSG:4326")

# Piezometric stations
piezo_stations = pd.read_csv(os.path.join(app_root, 'data', 'piezometry', 'stations.csv'), delimiter=';', encoding='ISO-8859-1')
geometry_piezometry = [Point(xy) for xy in zip(piezo_stations['X_WGS84'], piezo_stations['Y_WGS84'])]
gdf_piezometry = gpd.GeoDataFrame(piezo_stations, geometry=geometry_piezometry, crs="EPSG:4326")

# Watershed boundaries
gdf_watersheds = gpd.read_file(os.path.join(app_root, 'data', 'watersheds.shp'))
gdf_watersheds = gdf_watersheds.set_index('index')

for i in gdf_watersheds.index:

    # Extraire les coordonnées des limites de la géométrie du polygone à l'index courant
    minx, miny, maxx, maxy = gdf_watersheds['geometry'].bounds.loc[i]
    
    # Créer les colonnes min_lon, min_lat, max_lon et max_lat et leur assigner les valeurs extraites
    gdf_watersheds.loc[i, 'min_lon'] = minx
    gdf_watersheds.loc[i, 'min_lat'] = miny
    gdf_watersheds.loc[i, 'max_lon'] = maxx
    gdf_watersheds.loc[i, 'max_lat'] = maxy


class Users(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(255), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())
    role = db.Column(db.Enum('acteur de l\'eau', 'scientifique','dev'), nullable=False)

    def set_password(self, password):
        self.password = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password, password)

@login_manager.user_loader
def load_user(user_id):
    return Users.query.get(int(user_id))

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    user = Users.query.filter_by(username=username).first()
    if user and user.check_password(password):
        login_user(user)
        return jsonify({'message': 'Logged in successfully', 'username': username, 'role': user.role, "UserID":user.id}), 200
    return jsonify({'error': 'Invalid username or password'}), 401

@app.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Logged out successfully'}), 200

@app.route('/users', methods=['POST'])
def create_user():
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data or 'role' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
    username = data.get('username')
    password = data.get('password')
    role = data.get('role')
    user_exists = Users.query.filter_by(username=username).first()
    if user_exists:
        return jsonify({'error': 'Username already exists'}), 409
    new_user = Users(username=username, role=role)
    new_user.set_password(password)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'message': 'User successfully registered'}), 201

Base = declarative_base()

# Définition du modèle pour SQLAlchemy
class Simulation(db.Model):
    __tablename__ = 'Simulations'
    SimulationID = db.Column(db.String(36), primary_key=True)
    UserID = db.Column(db.Integer, nullable=False)
    Parameters = db.Column(db.JSON, nullable=True)
    SimulationDate = db.Column(DateTime, default=func.now())
    Indicators = db.Column(db.JSON, default= [])
    Results = db.Column(db.JSON, nullable = True, default = {})


@app.route('/api/simulations', methods=['GET'])
@login_required
def get_simulations():
    # Assurez-vous que l'utilisateur est connecté et récupérez son ID
    user_id = current_user.id

    # Récupérer les simulations correspondant à cet utilisateur
    simulations = Simulation.query.filter_by(UserID=user_id).all()

    # Préparer les données pour la réponse
    results = [
        {'SimulationID': simulation.SimulationID,
         'parameters': simulation.Parameters,
         'creation_date': simulation.SimulationDate.strftime("%Y-%m-%d %H:%M:%S")}  # Formatage de la date
        for simulation in simulations
    ]

    # Renvoyer les données sous forme de JSON
    return jsonify(results)

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


@app.route('/osur/getoldBSS', methods=['GET'])
@cross_origin()
def get_oldBSS():
   # We don't use this one yet
    request_id = flask.request.args.get('ID')

    json_list = []

    with open("data/piezometry/stations.csv", 'r') as csv_file:
        # Attention faire attention au delimiter (sinon y a un erreur)
        csv_reader = csv.DictReader(csv_file, delimiter=';')
        for row in csv_reader:
            json_object = {
                'X_WGS84': row['X_WGS84'],
                'Y_WGS84': row['Y_WGS84'],
                'Identifiant_BSS': row['Identifiant BSS'],
                'Ancien_code_national_BSS': row['Ancien code national BSS']
            }
            json_list.append(json_object)

    return json_list

# gdf_stations conversion in a json format
@app.route('/osur/GetGDFStations', methods=['GET'])
@cross_origin()
def get_GDF_STATIONS():

    json_list = []
    
    for index, row in gdf_stations.iterrows():
        
        row['x_outlet'], row['y_outlet'] = lambert93_to_wgs84.transform(row["x_outlet"], row['y_outlet'] )
        geometry_geojson = mapping(row.geometry)
        
        BSS_ID_value = row['BSS_ID']
        if isinstance(BSS_ID_value, str) :
            BSS_ID_value = BSS_ID_value;        
        else:
            BSS_ID_value = ''
            
        BSS_name_value = row['BSS_name']
        if isinstance(BSS_name_value, str) :
            BSS_name_value = BSS_name_value;        
        else:
            BSS_name_value = ''
        
        # Convert gdf_stations to a json object
        json_object = {
            'index' : row['ID'],
            'name' : row['name'],
            'station_name' : row['station_name'],
            'BSS_name' : BSS_name_value,
            'BSS_ID' : BSS_ID_value,
            'x_outlet': row['x_outlet'],
            'y_outlet': row['y_outlet'],
            'area' : row['area'],
            'geometry': geometry_geojson,

        }
    
        json_list.append(json_object)
    
    return json_list


# gdf_piezometry conversion in a json format
@app.route('/osur/getGDFPiezometry', methods=['GET'])
@cross_origin()
def get_GDF_Piezometry():

    json_list = []

    for index, row in gdf_piezometry.iterrows():
        
        geometry_geojson = mapping(row.geometry)
        nom_value = row['Nom']
        
        if isinstance(nom_value, str) :
            nom_value = nom_value;        
        else:
            nom_value = ''
        
        # Crée un objet JSON avec les données de la ligne
        json_object = {
            'identifiant_BSS' : row['Identifiant BSS'],
            'x_wgs84':row['X_WGS84'],
            'y_wgs84':row['Y_WGS84'],
            'Nom' : nom_value,
            'oldBSS': row['Ancien code national BSS'],
            'geometry': geometry_geojson,
        }
       
        json_list.append(json_object)
    
    return json_list

# gdf_watersheds conversion in a json format
@app.route('/osur/GetGDFWatersheds', methods=['GET'])
@cross_origin()
def get_GDF_Watersheds():
    
    json_list = []

    for index, row in gdf_watersheds.iterrows():
    
        geometry_geojson = mapping(row.geometry)
        k1_value = row['K1']
    
        if isinstance(k1_value, str) and k1_value== 'NaN':
            k1_value = float(0)        
        else:
            k1_value = float(k1_value)
    
        # Crée un objet JSON avec les données de la ligne
        json_object = {
            'index' : index,
            'name' : row['name'],
            'geometry_a' : row['geometry_a'],
            'hydro_area' : row['hydro_area'],
            'K1': k1_value,
            'geometry': geometry_geojson,
            'min_lon':row['min_lon'],
            'min_lat':row['min_lat'],
            'max_lon':row['max_lon'],
            'max_lat':row['max_lat'],
        }
    
        json_list.append(json_object)
    
    return json_list


# Get discharge timeseries
@app.route('/osur/stationDischarge/<string:id>', methods=['GET'])
@cross_origin()
def get_stationdata(id):
    if id is not None:
        # Nom du fichier CSV basé sur l'identifiant
        csv_filename = f'{id}.csv'
        # Chemin complet vers le fichier CSV
        csv_file_path = os.path.join(hydrometry_path, 'discharge', csv_filename)
        # Vérifier si le fichier CSV existe
        if os.path.exists(csv_file_path):
            # Initialiser une liste pour stocker les données JSON
            id_upper = id.upper()
            for i in gdf_stations.index:
                if gdf_stations.loc[i, 'ID'] == id_upper:
                    station_name = gdf_stations.loc[i, 'station_name']
            json_list = []
            json_list.append(station_name)
            json_list.append(id_upper)
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


# Get temperature timeseries
@app.route('/osur/stationTemperature/<string:id>', methods=['GET'])
@cross_origin()
def get_temperature(id):
    if id is not None:
        # Nom du fichier CSV basé sur l'identifiant
        csv_filename = f'{id}.csv'
        # Chemin complet vers le fichier CSV
        csv_file_path = os.path.join(surfex_path, 'temperature', csv_filename)
        # Vérifier si le fichier CSV existe
        if os.path.exists(csv_file_path):
            # Initialiser une liste pour stocker les données JSON
            id_upper = id.upper()
            for i in gdf_stations.index:
                if gdf_stations.loc[i, 'ID'] == id_upper:
                    station_name = gdf_stations.loc[i, 'station_name']
            json_list = []
            json_list.append(station_name)
            json_list.append(id_upper)
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
    

# Get precipitation timeseries
@app.route('/osur/stationPrecipitation/<string:id>', methods=['GET'])
@cross_origin()
def get_precipitation(id):
    if id is not None:
        # Nom du fichier CSV basé sur l'identifiant
        csv_filename = f'{id}.csv'
        # Chemin complet vers le fichier CSV
        csv_file_path = os.path.join(surfex_path, 'precipitation', csv_filename)
        # Vérifier si le fichier CSV existe
        if os.path.exists(csv_file_path):
            # Initialiser une liste pour stocker les données JSON
            id_upper = id.upper()
            for i in gdf_stations.index:
                if gdf_stations.loc[i, 'ID'] == id_upper:
                    station_name = gdf_stations.loc[i, 'station_name']
            json_list = []
            json_list.append(station_name)
            json_list.append(id_upper)
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
    

# Get water-table depth timeseries
@app.route('/osur/stationWaterTableDepth/<string:id>', methods=['GET'])
@cross_origin()
def get_water_table_depth(id):

    bss_id = []

    # Initialiser une liste pour stocker les données JSON
    id_upper = id.upper()
    for i in gdf_stations.index:
        if gdf_stations.loc[i, 'ID'] == id_upper:
            station_name = gdf_stations.loc[i, 'station_name']
            bss_id = gdf_stations.loc[i, 'BSS_ID']

    if id is not None:
        # Nom du fichier CSV basé sur l'identifiant
        csv_filename = f'{bss_id}.csv'
        # Chemin complet vers le fichier CSV
        csv_file_path = os.path.join(piezometry_path, csv_filename)
        # Vérifier si le fichier CSV existe
        if os.path.exists(csv_file_path):
            
            # Initialiser une liste pour stocker les données JSON
            json_list = []
            json_list.append(station_name)
            json_list.append(bss_id)
            # Ouvrir le fichier CSV
            with open(csv_file_path, 'r', encoding='utf-8') as csv_file:
                # Attention au delimiter (si nécessaire)
                csv_reader = csv.DictReader(csv_file)
                # Parcourir les lignes du fichier CSV
                for row in csv_reader:
                    # Créer un dictionnaire JSON pour chaque ligne
                    json_object = {
                        't': row['t'],
                        'H': row['H'],
                        'd': row['d'],
                    }
                    # Ajouter le dictionnaire à la liste
                    json_list.append(json_object)
            # Retourner la liste JSON
            return jsonify(json_list), 200
        else:
            return jsonify({"filename": csv_filename,}), 404
    else:
        return jsonify({"error": "Identifiant non fourni"}), 404

@app.route('/api/delete_simulation/<simulation_id>', methods=['POST'])
def delete_simulation(simulation_id):
    try:
         # Recherche de la simulation à supprimer
        simulation = Simulation.query.get(simulation_id)
        if not simulation:
            return jsonify({"Error": "Simulation not found"}), 404
        
        # Supprimer la simulation correspondante
        db.session.delete(simulation)
        db.session.commit()
        return jsonify({"Succes":"Simulation deleted succesfully"}),200
    except Exception as e:
        return jsonify({"Error":str(e)}),500


def create_cydre_app(params):
    """Fonction pour initialiser et configurer l'application Cydre."""
    try: 
        # Initialiser l'app cydre
        init = INI.Initialization(app_root)  
        cydre_app = init.cydre_initialization()
        
        # Mettre à jour les paramètres de l'application en fonction des entrées
        param_names = ['user_watershed_id', 'user_horizon', 'date']
        param_paths = init.get_parameters_path(param_names)
        init.params.find_and_replace_param(param_paths[0], params.get('watershed'))
        init.params.find_and_replace_param(param_paths[1], int(params.get('slider')))
        init.params.find_and_replace_param(param_paths[2], str(params.get('date')))
        
        cydre_app = init.create_cydre_app()
        return cydre_app
    except Exception as e :
        app.logger.error("Erreur lors de la création de l'app: ",str(e))
        return e

@app.route('/api/run_cydre', methods=['POST'])
def run_cydre():
    data = request.json

    # Validation de base des données entrantes
    if not data or 'UserID' not in data or 'Parameters' not in data:
        return jsonify({'error': 'Missing required fields'}), 400

    try:
        # Création de l'identifiant de simulation unique
        simulation_id = str(uuid.uuid4())

        # Enregistrement initial dans la base de données
        new_simulation = Simulation(
            SimulationID=simulation_id,
            UserID=data['UserID'],
            Parameters=data['Parameters'],
            Indicators = [],
            Results = {"similarity": {"clusters":{},
                           "similar_watersheds": [],
                           "selected_scenarios":{},
                           "corr_matrix":{
                               "specific_discharge":{},
                               "recharge":{}
                           },
                           "user_similarity_period":[]
                           },
                        "data": {'graph': {},
                            'last_date': None,
                            'first_date': None,
                            },
                        "corr_matrix":{}}
        )
        db.session.add(new_simulation)
        db.session.commit()

        return jsonify({'message': 'Cydre simulation initialized', 'SimulationID': simulation_id}), 200

    except Exception as e:
        app.logger.error('Error starting cydre_app: %s', str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/api/run_spatial_similarity/<simulation_id>', methods=['POST'])
def run_spatial_similarity(simulation_id):
# Récupérer les paramètres de la simulation correspondant au simulation_id
    if not simulation_id:
        return jsonify({'error': 'Simulation not found'}), 404
    
    try:
        # Recréer l'app correspondant à l'id de simulation
        cydre_app,simulation = start_simulation_cydre_app(simulation_id)
        # Lancer le calcul des similarités spatiales
        cydre_app.run_spatial_similarity(spatial=True)
        # Convertir les données nécessaires aux étapes suivantes ou au résulats en JSON
        clusters_json = cydre_app.Similarity.clusters.to_json()
        similar_watersheds_json = json.dumps(cydre_app.Similarity.similar_watersheds)
        # Chemin JSON pour la mise à jour
        json_path_clusters = '$.similarity.clusters'
        json_path_similar_watersheds = '$.similarity.similar_watersheds'

        # Préparation de la mise à jour pour stocker les données
        stmt = (
            update(Simulation)
            .where(Simulation.SimulationID == simulation_id)
            .values({Simulation.Results: func.json_set(Simulation.Results, json_path_clusters, clusters_json)})
        )

        # Exécution de la mise à jour
        db.session.execute(stmt)
        stmt = (
            update(Simulation)
            .where(Simulation.SimulationID == simulation_id)
            .values({Simulation.Results: func.json_set(Simulation.Results, json_path_similar_watersheds, similar_watersheds_json)})
        )
        db.session.execute(stmt)
        db.session.commit()

    except Exception as e:
        app.logger.error('Error running spatial similarity": %s', str(e))
        return jsonify({'error': str(e)}), 500
    
    return {"Success":"Ran spatial similarity"}, 200


@app.route('/api/run_timeseries_similarity/<simulation_id>', methods=['POST'])
def run_timeseries_similarity(simulation_id):
    
    try:
        # Recréer l'app correspondant à l'id de simulation
        cydre_app,simulation = start_simulation_cydre_app(simulation_id)
        # Lancer le calcul des similarités temporelles, en s'appuyant sur les résultats des similarités spatiales
        cydre_app.run_timeseries_similarity(json.loads(simulation.Results.get("similarity").get("similar_watersheds")))
        # Récupérer la matrice de correlation
        corr_matrix = cydre_app.Similarity.correlation_matrix
        print(corr_matrix)
        # with open('dataframe_output.txt', 'w') as file:
        #     for index, row in corr_matrix.iterrows():
        #         file.write(f"{row['Nom']}, {row['Age']}, {row['Ville']}\n")

        # La transformer en JSON pour la stocker
        for key,value in corr_matrix.items():
            if key=="specific_discharge":
                specific_discharge = value.to_json(orient='split')
            elif key=="recharge":
                recharge = value.to_json(orient='split')
        # Chemins JSON pour les mises à jour
        json_path_specific_discharge = '$.similarity.corr_matrix.specific_discharge'
        json_path_recharge = '$.similarity.corr_matrix.recharge'
        json_path_similar_period = '$.similarity.user_similarity_period'


        # Préparation de la mise à jour
        stmt = (
            update(Simulation)
            .where(Simulation.SimulationID == simulation_id)
            .values({Simulation.Results: func.json_set(Simulation.Results, json_path_specific_discharge, specific_discharge)})
        )
        # Exécution de la mise à jour
        db.session.execute(stmt)
        # Préparation de la mise à jour
        stmt = (
            update(Simulation)
            .where(Simulation.SimulationID == simulation_id)
            .values({Simulation.Results: func.json_set(Simulation.Results, json_path_recharge, recharge)})
        )

        # Exécution de la mise à jour
        db.session.execute(stmt)
        stmt = (
            update(Simulation)
            .where(Simulation.SimulationID == simulation_id)
            .values({Simulation.Results: func.json_set(Simulation.Results, json_path_similar_period, json.dumps(cydre_app.Similarity.user_similarity_period.strftime('%Y-%m-%d').tolist()))})
        )
        db.session.execute(stmt)
        db.session.commit()
    except Exception as e:
        app.logger.error('Error running timeseries similarity": %s', str(e))
        return jsonify({'error': str(e)}), 500 
    return jsonify({"specific_discharge":json.loads(specific_discharge),"recharge":json.loads(recharge)}), 200

@app.route('/api/select_scenarios/<simulation_id>', methods=['POST'])
def select_scenarios(simulation_id):
    try:
        # Recréer l'app correspondant à l'id de simulation
        cydre_app,simulation = start_simulation_cydre_app(simulation_id)
        # Récuperer les éléments nécesssaires
        specific_discharge = simulation.Results.get("similarity").get("corr_matrix").get("specific_discharge")
        recharge = simulation.Results.get("similarity").get("corr_matrix").get("recharge")
        # Reconversion des chaînes JSON en DataFrame pour leur utilisation
        if specific_discharge:
            specific_discharge_df = pd.read_json(specific_discharge, orient='split')
        if recharge:
            recharge_df = pd.read_json(recharge, orient='split')

        # Appel de la méthode select_scenarios avec la DataFrame de corrélation
        scenarios_grouped,selected_scenarios = cydre_app.select_scenarios(spatial=True, corr_matrix={"specific_discharge": specific_discharge_df, "recharge": recharge_df})
        print(selected_scenarios)
        for key,value in selected_scenarios.items():
            if key=="specific_discharge":
                specific_discharge = value.to_json(orient='split')
                print(specific_discharge)
            elif key=="recharge":
                recharge = value.to_json(orient='split')
                print(recharge)
                print("fin recharge")
        
        
               # Chemin JSON de la mise à jour
        scenarios_grouped_path = '$.scenarios_grouped'
        selected_scenarios_path = '$.selected_scenarios'
        json_path_specific_discharge = selected_scenarios_path+'.specific_discharge'
        json_path_recharge = selected_scenarios_path+'.recharge' 

        # Préparation de la requête SQL pour la mise à jour
        stmt = (
            update(Simulation)
            .where(Simulation.SimulationID == simulation_id)
            .values({Simulation.Results: func.json_set(Simulation.Results, scenarios_grouped_path,scenarios_grouped.to_json())})
        )
        db.session.execute(stmt)
       # Préparation de la mise à jour
        stmt = (
            update(Simulation)
            .where(Simulation.SimulationID == simulation_id)
            .values({Simulation.Results: func.json_set(Simulation.Results, json_path_specific_discharge, specific_discharge)})
        )
        # Exécution de la mise à jour
        db.session.execute(stmt)
        # Préparation de la mise à jour
        stmt = (
            update(Simulation)
            .where(Simulation.SimulationID == simulation_id)
            .values({Simulation.Results: func.json_set(Simulation.Results, json_path_recharge, recharge)})
        )

        # Exécution de la mise à jour
        db.session.execute(stmt)
        
        db.session.commit()

        return jsonify({"scenarios grouped":scenarios_grouped.to_json(),"specific discharge":specific_discharge,"recharge":recharge}), 200
    except Exception as e : 
        return {"error":str(e)}, 500
    

def start_simulation_cydre_app(simulation_id):
    # Retrouver dans la base de données la simulation correspondante
    simulation = Simulation.query.filter_by(SimulationID=simulation_id).first()

    if not simulation:
        return jsonify({'error': 'Simulation not found'}), 404
    
    try:
        # Récupérer les paramètres
        params = simulation.Parameters

        # Initialisation et création de cydre_app
        cydre_app = create_cydre_app(params)
        watershed_name = stations[stations['ID'] == cydre_app.UserConfiguration.user_watershed_id].name.values[0]
        # Stocker le nom de la station dans les paramètres
        stmt = (
            update(Simulation)
            .where(Simulation.SimulationID == simulation_id)
            .values({Simulation.Parameters: func.json_set(Simulation.Parameters,'$.watershed_name',watershed_name)})
        )
        
        # Exécution de la mise à jour
        db.session.execute(stmt)
        db.session.commit()

        return cydre_app, simulation
    except Exception as e :
        return {"Error starting cydre app":str(e)}
    
@app.route('/api/simulateur/getGraph/<simulation_id>', methods=['GET'])
def getGraph(simulation_id):
    # Recréer l'app correspondant à l'id de simulation
    cydre_app,simulation = start_simulation_cydre_app(simulation_id)

    try:
        # Récuperer et re-transformer les éléments nécessaire à la création du graphe
        scenarios_grouped =  db.session.query(
            func.json_extract(Simulation.Results, '$.scenarios_grouped')
        ).filter(Simulation.SimulationID == simulation_id).scalar()
        scenarios_grouped = json.loads(scenarios_grouped)
        scenarios_grouped_dict = json.loads(scenarios_grouped)

        # Transformer le dictionnaire en une liste de tuples pour la conversion en Series
        index_values = [(int(key.split(',')[0][1:]), key.split(',')[1].split('\'')[1].strip()) for key in scenarios_grouped_dict.keys()]
        data_values = list(scenarios_grouped_dict.values())

        # Créer une MultiIndex pour le Series
        index = pd.MultiIndex.from_tuples(index_values, names=["Year", "Station"])

        # Créer un Series à partir des valeurs et de l'index
        series = pd.Series(data_values, index=index)
        cydre_app.scenarios_grouped = series

        watershed_name =  db.session.query(
            func.json_extract(Simulation.Parameters, '$.watershed_name')
        ).filter(Simulation.SimulationID == simulation_id).scalar()
        user_similarity_period =db.session.query(
            func.json_extract(Simulation.Results, '$.similarity.user_similarity_period')
        ).filter(Simulation.SimulationID == simulation_id).scalar()
        user_similarity_period = json.loads(user_similarity_period)

        similar_watersheds = db.session.query(
            func.json_extract(Simulation.Results, '$.similarity.similar_watersheds')
        ).filter(Simulation.SimulationID == simulation_id).scalar()
        similar_watersheds = json.loads(similar_watersheds)

        cydre_app.df_streamflow_forecast, cydre_app.df_storage_forecast = cydre_app.streamflow_forecast()

        #Créer le graphe 
        results = Graph(cydre_app, watershed_name, stations, cydre_app.date, scenarios_grouped,user_similarity_period,similar_watersheds,
                            log=True, module=True, baseflow=False, options='viz_plotly')
        
        app.logger.info('Cydre app and Graph results are initialized and stored')

        # Calculer les projections
        graph_results = results.plot_streamflow_projections(module=True)
        # Transformer les résultats en JSON pour les stocker
        json_to_store =json.dumps({"graph":graph_results['graph'],"first_date":graph_results['first_date'],
                                   "last_date":graph_results['last_date'],
                                   'first_observation_date':graph_results['first_observation_date'],
                                   'last_observation_date':graph_results['last_observation_date'],
                                   'first_prediction_date':graph_results['first_prediction_date'],
                                   'last_prediction_date':graph_results['last_prediction_date']})
        # Mise à jour de chaque champ
        stmt = (
            update(Simulation)
            .where(Simulation.SimulationID == simulation_id)
            .values({
                Simulation.Results: func.json_set(
                    Simulation.Results,
                    text("'$.data'"), json_to_store
                )
            })
        )
        # Enregistrer les résultats liés au 1/10 du module dans la colonne Indicators
        mod10_string = {"type":"1/10 du module","value":graph_results['m10'], "color" : "#Ff0000", "results":{
        'proj_values': graph_results['proj_values'],
        'ndays_before_alert':graph_results['ndays_before_alert'],
        'ndays_below_alert': graph_results['ndays_below_alert'],
        'prop_alert_all_series': graph_results["prop_alert_all_series"],
        'volume50': graph_results['volume50'],
        'volume10': graph_results['volume10'],
        'volume90': graph_results['volume90'],
        }}

        # Trouver l'indicateur existant ou ajouter un nouvel indicateur
        found = False
        if simulation.Indicators:
            for indicator in simulation.Indicators:
                if indicator['type'] == "1/10 du module":
                    indicator.update(mod10_string)
                    found = True
                    break

        if not found:
            if not simulation.Indicators:
                simulation.Indicators = []
            simulation.Indicators.append(mod10_string)
        # Exécution de la mise à jour
        db.session.execute(stmt)
        db.session.commit()

        return jsonify({'success':'Graph has been returned and stored'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/simulateur/update_indicator/<simulation_id>', methods=['POST'])
def update_indicator(simulation_id):
    try:
        data = request.get_json()
        if not data or 'type' not in data or 'value' not in data:
            return jsonify({'Error': 'Missing data for indicator name or value'}), 400

        simulation = Simulation.query.filter_by(SimulationID=simulation_id).first()
        if not simulation:
            return jsonify({'Error': 'Simulation not found'}), 404

        
        # Recréer l'app correspondant à l'id de simulation
        cydre_app, simulation = start_simulation_cydre_app(simulation_id)

        #Récuperer les scénarios de la simulation
        scenarios_grouped =  db.session.query(
            func.json_extract(Simulation.Results, '$.scenarios_grouped')
        ).filter(Simulation.SimulationID == simulation_id).scalar()
        
        scenarios_grouped = json.loads(scenarios_grouped)
        scenarios_grouped_dict = json.loads(scenarios_grouped)

        # Transformer le dictionnaire en une liste de tuples pour la conversion en Series
        index_values = [(int(key.split(',')[0][1:]), key.split(',')[1].split('\'')[1].strip()) for key in scenarios_grouped_dict.keys()]
        data_values = list(scenarios_grouped_dict.values())

        # Créer une MultiIndex pour le Series
        index = pd.MultiIndex.from_tuples(index_values, names=["Year", "Station"])

        # Créer un Series à partir des valeurs et de l'index
        series = pd.Series(data_values, index=index)
        cydre_app.scenarios_grouped = series

        # Récupérer les autres paramètres de la simulation nécessaires au calcul des prédictions liées à l'indicateur
        watershed_name =  db.session.query(
            func.json_extract(Simulation.Parameters, '$.watershed_name')
        ).filter(Simulation.SimulationID == simulation_id).scalar()
        
        user_similarity_period =db.session.query(
            func.json_extract(Simulation.Results, '$.similarity.user_similarity_period')
        ).filter(Simulation.SimulationID == simulation_id).scalar()
        user_similarity_period = json.loads(user_similarity_period)

        similar_watersheds = db.session.query(
            func.json_extract(Simulation.Results, '$.similarity.similar_watersheds')
        ).filter(Simulation.SimulationID == simulation_id).scalar()
        similar_watersheds = json.loads(similar_watersheds)

        cydre_app.df_streamflow_forecast, cydre_app.df_storage_forecast = cydre_app.streamflow_forecast()

        results = Graph(cydre_app, watershed_name, stations, cydre_app.date, scenarios_grouped,user_similarity_period,similar_watersheds,
                            log=True, module=True, baseflow=False, options='viz_plotly')
        
        #Calculer les nouvelles projections
        new_projections = results.new_projections(data.get('value'))
        new_indicator = {"type": data['type'], "value": data['value'], "color" : data.get("color"),"results":new_projections}

        if not simulation.Indicators:
            simulation.Indicators = []
        found =False
        for indicator in simulation.Indicators:
            if indicator['type'] == data['type']:
                indicator.update(new_indicator)
                found = True
                break

        if not found:
            print("ADDING INDICATOR TO DATABASE")
            simulation.Indicators.append(new_indicator)   
        flag_modified(simulation, "Indicators")
        db.session.commit()
        return jsonify({"Success": "Indicator updated or added successfully"}), 200

    except Exception as e:
        app.logger.error(f"Error adding/updating indicator: {str(e)}")  # Log the error
        return jsonify({"Error": str(e)}), 500
    

@app.route('/api/simulateur/get_indicators_value/<simulation_id>', methods=['GET'])
def get_indicators_value(simulation_id):
    #Récuperer la simulation concernée
    simulation = Simulation.query.filter_by(SimulationID=simulation_id).first()
    if not simulation:
        return jsonify({'Error': 'Simulation not found'}), 404
    
    #Récupérer ses indicateurs
    indicators = simulation.Indicators
    return indicators, 200

@app.route('/api/simulateur/remove_indicator/<simulation_id>', methods=['POST'])
def remove_indicator(simulation_id):
    try:
        # Récupérer les données envoyées avec la requête, supposons que l'indicateur à supprimer soit identifié par son 'type'
        data = request.get_json()
        indicator_type = data.get('type')

        if not indicator_type:
            return jsonify({'Error': 'Missing indicator type'}), 400

        # Trouver la simulation correspondante
        simulation = Simulation.query.filter_by(SimulationID=simulation_id).first()
        if not simulation:
            return jsonify({'Error': 'Simulation not found'}), 404

        # Vérifier que la simulation a des indicateurs
        if not simulation.Indicators:
            return jsonify({'Error': 'No indicators to remove'}), 404

        # Filtrer pour enlever l'indicateur
        original_count = len(simulation.Indicators)
        simulation.Indicators = [indicator for indicator in simulation.Indicators if indicator.get('type') != indicator_type]
        if len(simulation.Indicators) == original_count:
            return jsonify({'Message': 'No indicator found with the specified type'}), 404

        # Marquer les indicateurs comme modifiés
        flag_modified(simulation, "Indicators")

        # Sauvegarder les changements
        db.session.commit()

        return simulation.Indicators, 200

    except Exception as e:
        app.logger.error(f"Error removing indicator: {str(e)}")
        return jsonify({'Error': str(e)}), 500

@app.route('/api/simulateur/getCorrMatrix/<simulation_id>', methods=['GET'])
def getCorrMatrix(simulation_id):
    # Recréer l'app correspondant à l'id de simulation
    cydre_app, simulation = start_simulation_cydre_app(simulation_id)

    scenarios_grouped =  db.session.query(
            func.json_extract(Simulation.Results, '$.scenarios_grouped')
        ).filter(Simulation.SimulationID == simulation_id).scalar()
    scenarios_grouped = json.loads(scenarios_grouped)
    scenarios_grouped_dict = json.loads(scenarios_grouped)

    # Transformer le dictionnaire en une liste de tuples pour la conversion en Series
    index_values = [(int(key.split(',')[0][1:]), key.split(',')[1].split('\'')[1].strip()) for key in scenarios_grouped_dict.keys()]
    data_values = list(scenarios_grouped_dict.values())

    # Créer une MultiIndex pour le Series
    index = pd.MultiIndex.from_tuples(index_values, names=["Year", "Station"])

    # Créer un Series à partir des valeurs et de l'index
    series = pd.Series(data_values, index=index)
    cydre_app.scenarios_grouped = series

    try:
        corr_matrix = pd.DataFrame(cydre_app.scenarios_grouped)
        df = corr_matrix.reset_index()
        df.columns = ['Year', 'ID', 'Coeff']
        df['Coeff'] = df['Coeff'].round(2)
        df['ID'] = df['ID'].map(gdf_stations.set_index('ID')['name'].to_dict())
        df = df.astype({'Year': 'int', 'Coeff': 'float'})
        corr_matrix = df.to_dict(orient='records')
        stmt = (
            update(Simulation)
            .where(Simulation.SimulationID == simulation_id)
            .values({Simulation.Results: func.json_set(Simulation.Results,'$.corr_matrix',json.dumps(corr_matrix))})
        )
        db.session.execute(stmt)
        db.session.commit()
        return jsonify(corr_matrix),200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/results/<simulation_id>', methods=['GET'])
def get_results(simulation_id):
    try:
        if(simulation_id):
            simulation = Simulation.query.filter_by(SimulationID=simulation_id).first()
            results = simulation.Results
            indicators = simulation.Indicators
            return jsonify({"results":results,"indicators":indicators}),200
        else:
            return jsonify({"Error":"No simulation ID given"}),500
    except Exception as e :
        return jsonify({"Error loading results ":str(e)})


#reprise de la classe Outputs permettant de générer le graphe
class Graph():
    def __init__(self,cydre_app,watershed_name, stations, selected_date,scenarios_grouped,user_similarity_period,similar_watersheds,
                    log=True, module=True, baseflow=False, options='viz_plotly'):
        self.watershed_id = cydre_app.UserConfiguration.user_watershed_id
        self.streamflow_proj = cydre_app.df_streamflow_forecast
        self.watershed_name = watershed_name
        self.watershed_area = cydre_app.watersheds[self.watershed_id]['hydrometry']['area']
        self.streamflow = cydre_app.watersheds[self.watershed_id]['hydrometry']['specific_discharge']
        self.streamflow_proj_series = cydre_app.Forecast.Q_streamflow_forecast_normalized
        self.projection_period = cydre_app.Forecast.forecast_period
        self.station_forecast = cydre_app.df_station_forecast
        self.scenarios = scenarios_grouped
        self.simulation_date = cydre_app.date
        self.similarity_period = user_similarity_period
        self.similar_watersheds = similar_watersheds



    def _get_streamflow(self):
        
        # Observation
        reference_df = self.streamflow.copy()
        reference_df['daily'] = reference_df.index.strftime('%m-%d')
        reference_df['Q'] *= (self.watershed_area * 1e6) # m/s > m3/s
        
        # Projections
        projection_df = self.streamflow_proj.copy()
        projection_df = projection_df.set_index(self.projection_period)
        projection_df *= self.watershed_area * 1e6 # m/s > m3/s
        
        # Individual projections
        projection_series = []
        
        for serie in self.streamflow_proj_series:
            serie = pd.DataFrame(serie)
            serie['Q_streamflow'] *= (self.watershed_area * 1e6)
            serie = serie.set_index(self.projection_period)
            projection_series.append(serie)
        
        return reference_df, projection_df, projection_series
    
    def new_projections(self, m10):
        reference_df, projection_df, projection_series = self._get_streamflow()
        # Update the module calculation
        self.mod10 = m10
        
        # Proportion of past events below the alert threshold
        n_events = len(projection_series)
        n_events_alert = 0
        
        for events in range(len(projection_series)):
            projection_series[events]['intersection'] = projection_series[events]['Q_streamflow'] <= self.mod10
            projection_series[events]['alert'] = projection_series[events]['intersection'] & projection_series[events]['intersection'].shift(-1)
            if projection_series[events]['alert'].any():
                n_events_alert += 1
            else:
                n_events_alert += 0
        
        self.prop_alert_all_series = n_events_alert / n_events

        # Initialize volumes
        self.volume10 = 0
        self.volume50 = 0
        self.volume90 = 0
        

        # Ensure proper calculation and error handling for each volume
        try:
            alert_df = projection_df[projection_df['Q10'] <= self.mod10]
            q_values = alert_df['Q10'] * 86400
            self.volume10 = ((self.mod10 * 86400) - q_values).sum()
        except Exception as e:
            print(f"Error in volume10 calculation: {e}")

        try:
            alert_df = projection_df[projection_df['Q50'] <= self.mod10]
            q_values = alert_df['Q50'] * 86400
            self.volume50 = ((self.mod10 * 86400) - q_values).sum()
        except Exception as e:
            print(f"Error in volume50 calculation: {e}")

        try:
            alert_df = projection_df[projection_df['Q90'] <= self.mod10]
            q_values = alert_df['Q90'] * 86400
            self.volume90 = ((self.mod10 * 86400) - q_values).sum()
        except Exception as e:
            print(f"Error in volume90 calculation: {e}")

        mod10_intersect = projection_df[['Q10', 'Q50', 'Q90']] <= self.mod10
        mod10_alert = mod10_intersect & mod10_intersect.shift(-1)

        try:
            mod10_first_occurence_Q10 = projection_df[mod10_alert['Q10']].iloc[0].name 
            self.ndays_before_alert_Q10 = (mod10_first_occurence_Q10 - projection_df.index[0]).days
        except:
            mod10_first_occurence_Q10 = None
            self.ndays_before_alert_Q10 = 0
        
        try:
            mod10_first_occurence_Q50 = projection_df[mod10_alert['Q50']].iloc[0].name 
            self.ndays_before_alert_Q50 = (mod10_first_occurence_Q50 - projection_df.index[0]).days
        except:
            mod10_first_occurence_Q50 = None
            self.ndays_before_alert_Q50 = 0
            
        try:
            mod10_first_occurence_Q90 = projection_df[mod10_alert['Q90']].iloc[0].name
            self.ndays_before_alert_Q90 = (mod10_first_occurence_Q90 - projection_df.index[0]).days
        except:
            mod10_first_occurence_Q90 = None
            self.ndays_before_alert_Q90 = 0
        # Number of cumulated days below the alert threshold
        self.ndays_below_alert = np.sum(mod10_intersect)

        results = {
            'volume50': float(self.volume50),
            'volume10': float(self.volume10),
            'volume90': float(self.volume90),
            'prop_alert_all_series': int(self.prop_alert_all_series),
            'ndays_before_alert':{
                'Q10': float(self.ndays_before_alert_Q10),
                'Q50': float(self.ndays_before_alert_Q50),
                'Q90': float(self.ndays_before_alert_Q90),
            },
            'ndays_below_alert': {
                'Q10': float(self.ndays_below_alert['Q10']),
                'Q50': float(self.ndays_below_alert['Q50']),
                'Q90': float(self.ndays_below_alert['Q90']),
            },
        }
        return results

    
    def plot_streamflow_projections(self, log=True, module=False, baseflow=False, options='viz_plotly'):
        # -------------- CYDRE RESULTS --------------

        # Extract observation and projection timeseries data
        reference_df, projection_df, projection_series = self._get_streamflow()
        
        # Adding stations projections
        self.station_forecast.index = projection_df.index
        projection_df['Q50_station'] = self.station_forecast['Q50']
        projection_df['Q50_station'] *= (self.watershed_area * 1e6)
        projection_df['Q10_station'] = self.station_forecast['Q10']
        projection_df['Q10_station'] *= (self.watershed_area * 1e6)
        projection_df['Q90_station'] = self.station_forecast['Q90']
        projection_df['Q90_station'] *= (self.watershed_area * 1e6)
        
        # -------------- OPERATIONAL INDICATORS --------------
        
        # Calculate the module (1/10 x mean streamflow)
        if module:
            self.mod, self.mod10 = self._module(reference_df)
        
        
        # Projected streamflow (last day value and evolution)
        self.proj_values = projection_df.iloc[-1]
        self.proj_values_ev = (self.proj_values - reference_df['Q'][-1])/reference_df['Q'][-1] * 100
        
        # Number of days before projected streamflow intersect the module
        mod10_intersect = projection_df[['Q10', 'Q50', 'Q90']] <= self.mod10
        mod10_alert = mod10_intersect & mod10_intersect.shift(-1)
        
        try:
            mod10_first_occurence_Q10 = projection_df[mod10_alert['Q10']].iloc[0].name 
            self.ndays_before_alert_Q10 = (mod10_first_occurence_Q10 - projection_df.index[0]).days
        except:
            mod10_first_occurence_Q10 = None
            self.ndays_before_alert_Q10 = 0
        
        try:
            mod10_first_occurence_Q50 = projection_df[mod10_alert['Q50']].iloc[0].name 
            self.ndays_before_alert_Q50 = (mod10_first_occurence_Q50 - projection_df.index[0]).days
        except:
            mod10_first_occurence_Q50 = None
            self.ndays_before_alert_Q50 = 0
            
        try:
            mod10_first_occurence_Q90 = projection_df[mod10_alert['Q90']].iloc[0].name
            self.ndays_before_alert_Q90 = (mod10_first_occurence_Q90 - projection_df.index[0]).days
        except:
            mod10_first_occurence_Q90 = None
            self.ndays_before_alert_Q90 = 0
        
        # Number of cumulated days below the alert threshold
        self.ndays_below_alert = np.sum(mod10_intersect)
        
        # Proportion of past events below the alert threshold
        n_events = len(projection_series)
        n_events_alert = 0
        
        for events in range(len(projection_series)):
            projection_series[events]['intersection'] = projection_series[events]['Q_streamflow'] <= self.mod10
            projection_series[events]['alert'] = projection_series[events]['intersection'] & projection_series[events]['intersection'].shift(-1)
            if projection_series[events]['alert'].any():
                n_events_alert += 1
            else:
                n_events_alert += 0
        
        self.prop_alert_all_series = n_events_alert / n_events
        
        # Volume to supply low flows
        alert_df = projection_df[mod10_alert['Q10']]
        q_values = alert_df['Q10'] * 86400
        self.volume10 = ((self.mod10*86400) - q_values).sum()
        
        alert_df = projection_df[mod10_alert['Q50']]
        q_values = alert_df['Q50'] * 86400
        self.volume50 = ((self.mod10*86400) - q_values).sum()
        
        alert_df = projection_df[mod10_alert['Q90']]
        q_values = alert_df['Q90'] * 86400
        self.volume90 = ((self.mod10*86400) - q_values).sum()
        
        

        # Calculate baseflow
        if baseflow:
            self.Q_baseflow = self.baseflow()
            reference_df['baseflow'] = self.Q_baseflow * self.watershed_area * 1e6
            
        # Merge observation and projection timeseries data
        merged_df = pd.merge(reference_df, projection_df, left_on=reference_df.index,
                             right_on=projection_df.index, how='right')
        merged_df = merged_df.set_index(merged_df['key_0'])

         #On ne stocke pas les données en x qui sont des dates générables dans le front
        data =[
            go.Scatter(x=None, y=merged_df['Q90'].tolist(), mode='lines', line=dict(color='#407fbd', width=1), name="Q90").to_plotly_json(),
            go.Scatter(x=None, y=merged_df['Q50'].tolist(), mode='lines', line=dict(color='blue', width=1.5, dash='dot'), name='Q50').to_plotly_json(),
            go.Scatter(x=None, y=merged_df['Q10'].tolist(), mode='lines', line=dict(color='#407fbd', width=1), name="Q10").to_plotly_json(),
            go.Scatter(x=None, y=reference_df['Q'].tolist(), mode='lines', line=dict(color='black', width=1.5), name="observations").to_plotly_json()
        ]


        # Convert each projection series DataFrame to a Plotly trace
        for idx, serie in enumerate(projection_series):
            serie_trace = go.Scatter(
                x=None, #On ne stocke pas les données en x qui sont des dates générables dans le front
                y=serie['Q_streamflow'].tolist(),
                mode='lines',
                line=dict(color='rgba(0, 0, 255, 0.2)', width=1),  # Semi-transparent blue lines
                name=f'Projection {idx + 1}'
            ).to_plotly_json()
            data.append(serie_trace)

        # #convert Timestamp data for json serialisation
        # for entry in data:
        #     entry['x'] = [ts.isoformat() if not isinstance(ts, str) else ts for ts in entry['x']]

        data = {
        'graph': data,
        'first_observation_date': reference_df.index.tolist()[0].isoformat(),#la première date d'observations
        'last_observation_date': reference_df.index.tolist()[len(reference_df.index.tolist())-1].isoformat(),#la dernière date d'observations
        'first_prediction_date': merged_df.index.tolist()[0].isoformat(),#la première date de perdicitions
        'last_prediction_date': merged_df.index.tolist()[len(merged_df.index.tolist())-1].isoformat(),#la dernière date de predictions
        'proj_values': {
            'Q50': float(self.proj_values.Q50),
            'Q10': float(self.proj_values.Q10),
            'Q90': float(self.proj_values.Q90)
        },
        'ndays_before_alert':{
            'Q50': float(self.ndays_before_alert_Q50),
            'Q90': float(self.ndays_before_alert_Q90),
            'Q10': float(self.ndays_before_alert_Q10)
        },
        'ndays_below_alert': {
            'Q50': float(self.ndays_below_alert['Q50']),
            'Q90': float(self.ndays_below_alert['Q90']),
            'Q10': float(self.ndays_below_alert['Q10'])
        },
        'prop_alert_all_series': int(self.prop_alert_all_series),
        'volume50': float(self.volume50),
        'volume10': float(self.volume10),
        'volume90': float(self.volume90),
        'last_date': self.projection_period[-1].strftime("%d/%m/%Y"),
        'first_date': self.simulation_date.strftime('%Y-%m-%d'),
        'm10':self.mod10
        }
        print(data['last_date'])
        print(data['first_date'])

        return data

    def _module(self, reference_df):
        reference_df['year'] = reference_df.index.year
        df = reference_df.groupby('year')['Q'].mean()
        mod = df.mean()
        mod10 = mod/10
        return mod, mod10
if __name__ == '__main__':
    app.run(host='localhost')
