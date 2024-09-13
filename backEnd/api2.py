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
from sqlalchemy import DateTime, func, text, update
from werkzeug.security import generate_password_hash, check_password_hash
import os,csv 
import pandas as pd
from shapely.geometry import mapping
import libraries.forecast.initialization as INI
import libraries.postprocessing.outputs as OUT
import xml.etree.ElementTree as ET
from collections import OrderedDict

from libraries.load_data import define_paths, load_data
from libraries.utils.toolbox import lambert93_to_wgs84, read_csv_and_generate_response, extract_param_names, OrderedDictEncoder


#%% INITIALIZATION OF FLASK SERVER

# Configuration, Flask is the library necessary to exchange with the website
app = flask.Flask(__name__)
# Autorisation de requête sur le site web par angular et en test sur apirequest.io
CORS(app, supports_credentials=True, origins=["http://localhost:4200", "https://apirequest.io"])
app.config['CORS_HEADERS'] = 'Content-Type'
# Magage Database in python (database des utilisateurs et des simulations, une table pour les utilisateurs, une table pour les simulations)
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:diverse35@localhost/cydre'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'une_cle_secrete_tres_complexe'

# Database effective
db = SQLAlchemy(app)
# Extension de flask pour les bases de données
login_manager = LoginManager()
login_manager.init_app(app)

#%% INITIALIZATION OF CYDRE: Loading stations, watershed boundaries, location of files
app_root = os.path.dirname(os.path.abspath("api2.py"))
(data_path, hydrometry_path, surfex_path, piezo_path, hydraulic_path, output_path) = define_paths(app_root)
gdf_stations, gdf_piezometry, gdf_watersheds = load_data(app_root)


#%% INITIALIZATION OF USER DATABASE (MYSQL)
Base = declarative_base()

# Définition du model Users pour SQLAlchemy
class Users(db.Model, UserMixin):
    # Struicture of Users database
    __tablename__ = "Users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(255), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())
    role = db.Column(db.Enum('acteur de l\'eau', 'scientifique','dev'), nullable=False)

    def set_password(self, password):
        self.password = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password, password)
    
# Définition du modèle Simulation pour SQLAlchemy
class Simulation(db.Model):
    __tablename__ = 'Simulations'
    SimulationID = db.Column(db.String(36), primary_key=True)
    UserID = db.Column(db.Integer, nullable=False)
    Parameters = db.Column(db.JSON, nullable=True)
    SimulationDate = db.Column(DateTime, default=func.now())
    Indicators = db.Column(db.JSON, default= [])
    Results = db.Column(db.JSON, nullable = True, default = {})

# Définition du modèle SimulationsBeta pour SQLAlchemy (table contenant les simulations déjà éxécutées afin d'éviter un chargement)
class SimulationsBeta(db.Model):
    __tablename__ = 'SimulationsBeta'
    SimulationID = db.Column(db.String(36), primary_key=True)
    Parameters = db.Column(db.JSON, nullable=True)
    SimulationDate = db.Column(DateTime, default=func.now())
    Indicators = db.Column(db.JSON, default= [])
    Results = db.Column(db.JSON, nullable = True, default = {})

# Fonction qui retourne un utilisateur de la table selon son ID
@login_manager.user_loader
def load_user(user_id):
    return Users.query.get(int(user_id))

# Route permettant le login d'un utilisateur 
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    user = Users.query.filter_by(username=username).first()
    if user and user.check_password(password):
        login_user(user)
        return jsonify({'message': 'Logged in successfully', 'username': username, 'role': user.role, "UserID":user.id}), 200
    return jsonify({'error': 'Invalid username or password'}), 401

# Route permettant le logout d'un utilisateur 
@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Logged out successfully'}), 200


# Route permettant de créer un utilisateur 
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

# Route permettant de récupérer toutes les simulations d'un utilisateur 
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


# Route permettant de supprimer une simulation grâce à son ID
@app.route('/api/delete_simulation/<simulation_id>', methods=['POST'])
@cross_origin()
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
    
# Route permettant de supprimer toutes les simulations de l'utilisateur "default", 
# Ces simulations sont celles des utilisateurs non connectés
@app.route('/api/delete_default_simulation', methods=['POST'])
@cross_origin()
def delete_default_simulation():
    try:
        # Retrieve the default user
        default_user = Users.query.filter_by(username="default").first()
        if not default_user:
            return jsonify({"Error": "Default user not found"}), 404

        # Get the user ID
        default_user_id = default_user.id

        # Find the simulation to delete
        simulation = Simulation.query.filter_by(UserID=default_user_id).first()

        if not simulation:
            return jsonify({"Success": "No default simulation to delete"}), 201

        # Delete the simulation
        db.session.delete(simulation)
        db.session.commit()
        return jsonify({"Success": "Simulation deleted successfully"}), 200
    except Exception as e:
        return jsonify({"Error": str(e)}), 500


# gdf_stations conversion in a json format
@app.route('/osur/GetGDFStations', methods=['GET'])
@cross_origin()
def get_GDF_STATIONS():

    json_list = []
    
    for index, row in gdf_stations.iterrows():
        
        # Convertir les coordonnées en WGS84 et en GeoJSON
        row['x_outlet'], row['y_outlet'] = lambert93_to_wgs84(row["x_outlet"], row['y_outlet'] )
        geometry_geojson = mapping(row.geometry)
        
        # Vérifier qu'il existe une valeur sinon string vide
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

        typology_value = row['typology']
        if np.isnan(typology_value) :
            typology_value = 99.00
        else:
            typology_value = typology_value

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
            'typology':typology_value,
        }
    
        json_list.append(json_object)
    
    return json_list


# gdf_piezometry conversion in a json format
@app.route('/osur/getGDFPiezometry', methods=['GET'])
@cross_origin()
def get_GDF_Piezometry():

    json_list = []

    for index, row in gdf_piezometry.iterrows():
        
        # Convertir les polygones en GeoJSON
        geometry_geojson = mapping(row.geometry)

        # Nom de la station piézométrique
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
        
        # Convertir les polygones en GeoJSON
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


# Get discharge timeseries (used for site documentation, "fiche de sites")
@app.route('/osur/stationDischarge/<string:id>', methods=['GET'])
@cross_origin()
def get_discharge(id):
    if id is not None:
        id_upper = id.upper()
        csv_file_path = os.path.join(hydrometry_path, f'{id}.csv')
        return read_csv_and_generate_response(csv_file_path, id_upper, gdf_stations, ['t', 'Q'])
    else:
        return jsonify({"error": "Identifiant non fourni"}), 404


# Get temperature timeseries
@app.route('/osur/stationTemperature/<string:id>', methods=['GET'])
@cross_origin()
def get_temperature(id):
    if id is not None:
        id_upper = id.upper()
        csv_file_path = os.path.join(surfex_path, 'etp', f'{id}.csv')
        return read_csv_and_generate_response(csv_file_path, id_upper, gdf_stations, ['t', 'Q'])
    else:
        return jsonify({"error": "Identifiant non fourni"}), 404


# Get precipitation timeseries
@app.route('/osur/stationPrecipitation/<string:id>', methods=['GET'])
@cross_origin()
def get_precipitation(id):
    if id is not None:
        id_upper = id.upper()
        csv_file_path = os.path.join(surfex_path, 'precipitation', f'{id}.csv')
        return read_csv_and_generate_response(csv_file_path, id_upper, gdf_stations, ['t', 'Q'])
    else:
        return jsonify({"error": "Identifiant non fourni"}), 404
    

# Get water-table depth timeseries
@app.route('/osur/stationWaterTableDepth/<string:id>', methods=['GET'])
@cross_origin()
def get_water_table_depth(id):

    id_upper = id.upper()

    # Get from gdf_stations the station name and the BSS ID
    station_info = gdf_stations[gdf_stations['ID'] == id_upper][['station_name', 'BSS_ID']]
    station_name = station_info.iloc[0]['station_name']
    bss_id = station_info.iloc[0]['BSS_ID']

    if id is not None:
        
        csv_filename = f'{bss_id}.csv'
        csv_file_path = os.path.join(piezo_path, csv_filename)
        
        # Vérifier si le fichier CSV existe
        if os.path.exists(csv_file_path):
            
            # Initialiser une liste pour stocker les données JSON
            json_list = []
            json_list.append(station_name)
            json_list.append(bss_id)

            # Convertir les données piézo en JSON
            df = pd.read_csv(csv_file_path, usecols=['t', 'H', 'd'], encoding='utf-8')
            json_list.extend(df.to_dict(orient='records'))

            return jsonify(json_list), 200
        else:
            return jsonify({"filename": csv_filename,}), 404
    else:
        return jsonify({"error": "Identifiant non fourni"}), 404


# Fonction permettant de relancer l'app cydre correspondant à une simulation à partir de son ID
def start_simulation(simulation_id):
    
    # Retrouver dans la base de données la simulation correspondante
    simulation = Simulation.query.filter_by(SimulationID=simulation_id).first()
    if not simulation:
        return jsonify({'error': 'Simulation not found'}), 404
    
    try:
        # Initialisation et création de cydre_app
        # Initialiser l'app cydre
        init = INI.Initialization(app_root, gdf_stations)
        cydre_app = init.cydre_initialization()
        
        # Récupérer les paramètres saisis par l'utilisateur.
        params = simulation.Parameters
        # Recrée la structure de paramètres à partir du json
        param_names = extract_param_names(params=params)
        # Mettre à jour les paramètres de l'application en fonction des entrées
        param_paths = init.get_parameters_path(param_names)
        param_paths_dict = {name: path for name, path in zip(param_names, param_paths) if path and name!='watershed_name'}
        for name in param_paths_dict.keys():
            path = param_paths_dict.get(name)
            if path != []:
                keys = name.split('.')
                value = params
                for key in keys:
                    value = value[key]
                init.params.find_and_replace_param(path, value)
        
        # Création de l'instance Cydre
        cydre_app = init.create_cydre_app()
        
        # Stocker le nom de la station dans les paramètres dans la base de données
        watershed_name = gdf_stations[gdf_stations['ID'] == cydre_app.UserConfiguration.user_watershed_id].name.values[0]
        station_name = cydre_app.UserConfiguration.user_watershed_name
        update_simulation(simulation_id, 'Parameters', '$.watershed_name',watershed_name)
        update_simulation(simulation_id, 'Parameters', '$.station_name',station_name)
    
        return cydre_app, simulation
    except Exception as e :
        return {"Error starting cydre app":str(e)}


def update_simulation(simulation_id, column_name, json_path, json_value):
    # Préparation de la mise à jour pour stocker les données
    stmt = (
        update(Simulation)
        .where(Simulation.SimulationID == simulation_id)
        .values({column_name: func.json_set(getattr(Simulation, column_name), json_path, json_value)})
    )
    
    # Exécution de la mise à jour
    db.session.execute(stmt)
    db.session.commit()


def get_simulation_results(simulation_id, column_name, json_path):
    """
    Extracts data from a specified JSON column in the Simulations table.
    """
    column = getattr(Simulation, column_name)
    try:
        result = db.session.query(
            func.json_extract(column, json_path)
        ).filter(Simulation.SimulationID == simulation_id).scalar()
        return result
    except Exception as e:
        return f"Error extracting data: {str(e)}"


# Route permettant de créer la simulation dans la base de données et renvoie son ID
@app.route('/api/create_simulation', methods=['POST'])
@cross_origin()
def create_simulation():
    
    data = request.json
    
    # Validation de base des données entrantes
    if not data or 'UserID' not in data or 'Parameters' not in data:
        return jsonify({'error': 'Missing required fields'}), 400

    # Si l'utilisateur n'est pas connecté renvoit l'ID de l'utilisateur défault de la BD.
    if data['UserID'] == 0:
        user = Users.query.filter_by(username="default").first()
        user_id = user.id
    else :
        user_id = data['UserID']

    try:
        # Création de l'identifiant de simulation unique
        simulation_id = str(uuid.uuid4())

        # Enregistrement initial dans la base de données
        new_simulation = Simulation(
            SimulationID=simulation_id,
            UserID=user_id,
            Parameters=data['Parameters'],
            Indicators = [],
            Results = {"similarity": {
                            "clusters":{},
                            "similar_watersheds": [],
                            "corr_matrix":{
                                "specific_discharge":{},
                                "recharge":{}
                                          },
                            "user_similarity_period":[]
                                    },
                        "data": {
                            'graph': {},
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


# Route permettant d'éxécuter les similarités spatiales pour une simulation et les stocker
@app.route('/api/run_spatial_similarity/<simulation_id>', methods=['POST'])
@cross_origin()
def run_spatial_similarity(simulation_id):
# Récupérer les paramètres de la simulation correspondant au simulation_id
    if not simulation_id:
        return jsonify({'error': 'Simulation not found'}), 404
    
    try:
        # Recréer l'app correspondant à l'id de simulation
        cydre_app,simulation = start_simulation(simulation_id)
        
        # Lancer le calcul des similarités spatiales
        cydre_app.run_spatial_similarity(hydraulic_path, gdf_stations)
        
        # Convertir les données à stocker au format JSON
        clusters_json = cydre_app.Similarity.clusters.to_json()
        similar_watersheds_json = json.dumps(cydre_app.Similarity.similar_watersheds)
        
        # Mise à jour de la simulation
        update_simulation(simulation_id, 'Results', '$.similarity.clusters', clusters_json)
        update_simulation(simulation_id, 'Results', '$.similarity.similar_watersheds', similar_watersheds_json)

    except Exception as e:
        app.logger.error('Error running spatial similarity": %s', str(e))
        return jsonify({'error': str(e)}), 500
    
    return {"Success":"Ran spatial similarity"}, 200


# Route permettant d'éxécuter les similarités temporelles pour une simulation et les stocker
@app.route('/api/run_timeseries_similarity/<simulation_id>', methods=['POST'])
@cross_origin()
def run_timeseries_similarity(simulation_id):
    
    try:
        # Recréer l'app correspondant à l'id de simulation
        cydre_app,simulation = start_simulation(simulation_id)
        
        # Lancer le calcul des similarités temporelles, en s'appuyant sur les résultats des similarités spatiales
        cydre_app.run_timeseries_similarity(data_path, json.loads(simulation.Results.get("similarity").get("similar_watersheds")))
        
        # Récupérer la matrice de correlation
        corr_matrix = cydre_app.Similarity.correlation_matrix
        
        # Convertir les données en JSON
        for key,value in corr_matrix.items():
            if key=="specific_discharge":
                specific_discharge = value.to_json(orient='split')
            elif key=="recharge":
                recharge = value.to_json(orient='split')
        
        user_similarity_period_json = json.dumps(cydre_app.Similarity.user_similarity_period.strftime('%Y-%m-%d').tolist())
        
        # Mise à jour de la simulation dans la base de données
        update_simulation(simulation_id, 'Results', '$.similarity.corr_matrix.specific_discharge', specific_discharge)
        update_simulation(simulation_id, 'Results', '$.similarity.corr_matrix.recharge', recharge)
        update_simulation(simulation_id, 'Results', '$.similarity.user_similarity_period', user_similarity_period_json)
        
    except Exception as e:
        app.logger.error('Error running timeseries similarity": %s', str(e))
        return jsonify({'error': str(e)}), 500 
    return jsonify({"specific_discharge":json.loads(specific_discharge),"recharge":json.loads(recharge)}), 200


# Route permettant de sélectionner les scénarios pour une simulation et les stocker
@app.route('/api/select_scenarios/<simulation_id>', methods=['POST'])
@cross_origin()
def select_scenarios(simulation_id):
    try:
        # Recréer l'app correspondant à l'id de simulation
        cydre_app, simulation = start_simulation(simulation_id)
        
        # Récuperer les éléments nécesssaires
        specific_discharge = simulation.Results.get("similarity").get("corr_matrix").get("specific_discharge")
        recharge = simulation.Results.get("similarity").get("corr_matrix").get("recharge")

        # Reconversion des chaînes JSON en DataFrame pour leur utilisation
        if specific_discharge:
            specific_discharge_df = pd.read_json(specific_discharge, orient='split')
        if recharge:
            recharge_df = pd.read_json(recharge, orient='split')

        # Vérifier et réinitialiser les index pour garantir l'unicité
        if not specific_discharge_df.index.is_unique:
            specific_discharge_df.reset_index(drop=True, inplace=True)
        if not recharge_df.index.is_unique:
            recharge_df.reset_index(drop=True, inplace=True)

        # Appel de la méthode select_scenarios avec la DataFrame de corrélation
        scenarios_grouped, selected_scenarios, scenarios = cydre_app.select_scenarios(corr_matrix={"specific_discharge": specific_discharge_df, "recharge": recharge_df})
        print("scenarios",scenarios)

        # Convertir les données en JSON
        for key, value in selected_scenarios.items():
            if key == "specific_discharge":
                specific_discharge = value.to_json(orient='split')
            elif key == "recharge":
                recharge = value.to_json(orient='split')
       
        scenarios_json = scenarios.to_json(orient = 'split')
        scenarios_grouped_json = scenarios_grouped.to_json()

        # Mise à jour de la simulation dans la base de données
        selected_scenarios_path = '$.selected_scenarios'
        json_path_specific_discharge = selected_scenarios_path + '.specific_discharge'
        json_path_recharge = selected_scenarios_path + '.recharge'
         
        update_simulation(simulation_id, 'Results', '$.scenarios_grouped',scenarios_grouped_json)
        update_simulation(simulation_id, 'Results', '$.scenarios',scenarios_json)
        update_simulation(simulation_id, 'Results', json_path_specific_discharge, specific_discharge)
        update_simulation(simulation_id, 'Results', json_path_recharge, recharge)
        
        return jsonify({"scenarios grouped": scenarios_grouped_json, "specific discharge": specific_discharge, "recharge": recharge, "scenarios":scenarios_json}), 200
    except Exception as e:
        return {"error": str(e)}, 500


def streamflow_forecast(cydre_app, simulation_id):
# Récuperer et re-transformer les éléments nécessaire aux résultats dédiés à la prévision des débits
    scenarios_grouped = get_simulation_results(simulation_id, 'Results', '$.scenarios_grouped')
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

    # Statistiques sur les débits passés pour générer des prévisions saisonnières
    cydre_app.df_streamflow_forecast, cydre_app.df_storage_forecast = cydre_app.streamflow_forecast(data_path)

    return cydre_app


# Route permettant de récupérer les données du graphe observations/prévisions d'une simulation grâce à son ID et les stocker
@app.route('/api/simulateur/getForecastResults/<simulation_id>', methods=['GET'])
@cross_origin()
def getForecastResults(simulation_id):
    # Recréer l'app correspondant à l'id de simulation
    cydre_app,simulation = start_simulation(simulation_id)

    try:
        # Statistiques sur les débits passés pour générer des prévisions saisonnières
        cydre_app = streamflow_forecast(cydre_app, simulation_id)

        # Préparation des sorties
        watershed_name = get_simulation_results(simulation_id, 'Parameters', '$.watershed_name')
        user_similarity_period = get_simulation_results(simulation_id, 'Results', '$.similarity.user_similarity_period') 
        results = OUT.Outputs(cydre_app, watershed_name, gdf_stations, cydre_app.date, user_similarity_period,
                              log=True, module=True, options='viz_plotly')
        app.logger.info('Cydre app and Graph results are initialized and stored')
        reference_df, projection_df, projection_series, merged_df = results.get_projections_data(module=True)
        graph_results = results.projections_angular_format(reference_df, projection_series, merged_df)

        # Transformer les données du Graph en JSON pour les stocker
        graph_json =json.dumps({"graph":graph_results['graph'],"first_date":graph_results['first_date'],
                                   "last_date":graph_results['last_date'],
                                   'first_observation_date':graph_results['first_observation_date'],
                                   'last_observation_date':graph_results['last_observation_date'],
                                   'first_prediction_date':graph_results['first_prediction_date'],
                                   'last_prediction_date':graph_results['last_prediction_date']})
        
        app.logger.info("data" + graph_json)
        # Mise à jour de chaque champ        
        update_simulation(simulation_id, 'Results', text("'$.data'"), graph_json)

        # Enregistrer les indicateurs opérationnels dans la colonne Indicators (ici le 1/10 du module)
        indicators_m10 = {"id" : "0",
                          "type":"1/10 du module",
                          "value":graph_results['m10'],
                          "color" : "#Ff0000",
                          "results":{
                            'proj_values': graph_results['proj_values'],
                            'ndays_before_alert':graph_results['ndays_before_alert'],
                            'ndays_below_alert': graph_results['ndays_below_alert'],
                            'prop_alert_all_series': graph_results["prop_alert_all_series"],
                            'volume50': graph_results['volume50'],
                            'volume10': graph_results['volume10'],
                            'volume90': graph_results['volume90'],
                            }
                        }
        
        # Trouver l'indicateur existant ou ajouter un nouvel indicateur
        found = False
        
        if simulation.Indicators:
            for indicator in simulation.Indicators:
                if indicator['type'] == "1/10 du module":
                    indicator.update(indicators_m10)
                    found = True
                    break

        if not found:
            if not simulation.Indicators:
                simulation.Indicators = []
            simulation.Indicators.append(indicators_m10)
        
        # Store correlation matrix
        corr_matrix = pd.DataFrame(cydre_app.scenarios_grouped)
        df = corr_matrix.reset_index()
        df.columns = ['Year', 'ID', 'Coeff']
        # Nettoyer les données
          # Remplacer NaN par des chaînes vides
        df['Coeff'] = df['Coeff'].round(2)
        df['ID'] = df['ID'].map(gdf_stations.set_index('ID')['name'].to_dict())
        df['ID'] = df['ID'].replace({np.nan: 'Unknown Station'})
        df = df.astype({'Year': 'int', 'Coeff': 'float'})
        # Convertir en dictionnaire
        corr_matrix = df.to_dict(orient='records')
        corr_matrix_json = json.dumps(corr_matrix)
        # Mise à jour de la base de données
        update_simulation(simulation_id, 'Results', '$.corr_matrix',corr_matrix_json)

        # Ce commit est essentiel pour que indicators_m10 soit pris en compte dans la base de données.
        # Pourquoi cet ajout ne se fait pas comme les autres mises à jour de la simulation ?
        db.session.commit()
        
        return jsonify({'success':'Graph has been returned and stored'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
    



@app.route('/api/simulateur/update_indicator/<simulation_id>', methods=['POST'])
@cross_origin()
def update_indicator(simulation_id):
    try:
        data = request.get_json()
        if not data or 'type' not in data or 'value' not in data:
            return jsonify({'Error': 'Missing data for indicator name or value'}), 400

        # Recherche de la simulation
        simulation = Simulation.query.filter_by(SimulationID=simulation_id).first()
        if not simulation:
            return jsonify({'Error': 'Simulation not found'}), 404
        
        # Recréer l'app correspondant à l'id de simulation
        cydre_app, simulation = start_simulation(simulation_id)

        # Statistiques sur les débits passés pour générer des prévisions saisonnières
        cydre_app = streamflow_forecast(cydre_app, simulation_id)

        # Récupérer les autres paramètres de la simulation nécessaires au calcul des prédictions liées à l'indicateur
        watershed_name = db.session.query(
            func.json_extract(Simulation.Parameters, '$.watershed_name')
        ).filter(Simulation.SimulationID == simulation_id).scalar()
        
        user_similarity_period = db.session.query(
            func.json_extract(Simulation.Results, '$.similarity.user_similarity_period')
        ).filter(Simulation.SimulationID == simulation_id).scalar()
        user_similarity_period = json.loads(user_similarity_period)
        
        # Calcul des nouvelles projections
        results = OUT.Outputs(cydre_app, watershed_name, gdf_stations, cydre_app.date, user_similarity_period,
                              log=True, module=True, options='viz_plotly')
        new_projections = results.new_projections(data.get('value'))

        # Si la liste des indicateurs n'existe pas encore, on l'initialise
        if not simulation.Indicators:
            simulation.Indicators = []

        new_indicator = {
            "id": data['id'],  # ID incrémenté
            "type": data['type'], 
            "value": data['value'], 
            "color": data.get("color"), 
            "results": new_projections
        }

        # Mise à jour ou ajout de l'indicateur
        found = False
        for indicator in simulation.Indicators:
            #vérifier si id existe déjà
            if indicator['id'] == data['id']: 
                app.logger.info("trouver!")
                indicator.update(new_indicator)
                found = True
                break

        if not found:
            print("ADDING INDICATOR TO DATABASE")
            simulation.Indicators.append(new_indicator)  # Ajouter un nouvel indicateur

        # Marquer le champ Indicators comme modifié
        flag_modified(simulation, "Indicators")
        db.session.commit()

        return jsonify({"Success": "Indicator updated or added successfully"}), 200

    except Exception as e:
        app.logger.error(f"Error adding/updating indicator: {str(e)}")  # Log de l'erreur
        return jsonify({"Error": str(e)}), 500

    

# Route renvoyant les valeurs de prévisions liées aux indicateurs d'une simulations
@app.route('/api/simulateur/get_indicators_value/<simulation_id>', methods=['GET'])
@cross_origin()
def get_indicators_value(simulation_id):
    #Récuperer la simulation concernée
    simulation = Simulation.query.filter_by(SimulationID=simulation_id).first()
    if not simulation:
        return jsonify({'Error': 'Simulation not found'}), 404
    
    #Récupérer ses indicateurs
    indicators = simulation.Indicators
    return indicators, 200


# Route permettant de supprimer un indicateur d'une simulation
@app.route('/api/simulateur/remove_indicator/<simulation_id>', methods=['POST'])
@cross_origin()
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


# Route renvoyant les résultats d'une simulation
@app.route('/api/results/<simulation_id>', methods=['GET'])
@cross_origin()
def get_results(simulation_id):
    try:
        if(simulation_id):
            simulation = Simulation.query.filter_by(SimulationID=simulation_id).first()
            results = simulation.Results
            indicators = simulation.Indicators
            watershed_name = simulation.Parameters['watershed_name']
            station_name = simulation.Parameters['station_name']
            try:
                userconfig = simulation.Parameters['UserConfig']
                watershed_id = userconfig['user_watershed_id']
            except:
                watershed_id = simulation.Parameters['user_watershed_id']
            
            
            print(watershed_name)
            print(watershed_id)
            print(station_name)

            return jsonify({"results":results,"indicators":indicators, "watershed_name":watershed_name,"watershed_id":watershed_id, "station_name":station_name}),200
        else:
            return jsonify({"Error":"No simulation ID given"}),500
    except Exception as e :
        return jsonify({"Error loading results ":str(e)})


# Renvoie les paramètres du fichier xml run_cydre_params.xml, le paramètre "default" indique si il faut renvoyer les valeurs par 
# défaut du fichier ou les valeurs actuelles.
@app.route('/api/parameters/<default>', methods=['GET'])
def get_parameters(default):
    root = parse_xml('./launchers/run_cydre_params.xml')
    params = parse_xml_to_ordered_dict(root, default.lower() == 'true')
    response = app.response_class(
        response=json.dumps(params, cls=OrderedDictEncoder),
        mimetype='application/json'
    )
    return response

# Route permettant de mettre à jour les valeurs dans le fichier run_cydre_params.xml 
@app.route('/api/parameters', methods=['POST'])
def update_parameters():
    data = request.json
    update_xml('./launchers/run_cydre_params.xml', data)
    return jsonify({"message": "Parameters updated successfully"})


# Fonction remplaçant dans le fichier xml au path "file_path", les valeurs correspondant à celle dans le json "data" 
def update_xml(file_path, data):
    tree = ET.parse(file_path)
    root = tree.getroot()
    for key, value in data.items():
        element = root.find(".//*[@name='{}']/value".format(key))
        if element is not None:
            print("on change ", key)
            element.text = value
    tree.write(file_path)

# Fonction permettant de parser le fichier xml en gardant ses paramètres dans l'ordre
def parse_xml_to_ordered_dict(element, default):
    """Convertit un élément XML en un OrderedDict imbriqué en incluant les possible_values."""
    result = OrderedDict()
    if len(element) > 0:
        for child in element:
            if child.tag == 'ParametersGroup':
                result[child.attrib['name']] = parse_xml_to_ordered_dict(child, default)
            elif child.tag == 'Parameter':
                param_name = child.attrib['name']
                description = child.find('description').text.strip().replace('\n', ' ').replace('\t', ' ')
                param_type = child.find('type').text.strip().replace('\n', ' ').replace('\t', ' ')

                if default:
                    param_value = child.find('default_value').text
                else:
                    param_value = child.find('value').text

                possible_values = child.find('possible_values').text
                possible_values_list = possible_values.split('; ') if possible_values else []

                result[param_name] = OrderedDict({
                    'value': param_value,
                    'possible_values': possible_values_list,
                    'description': description,
                    'type': param_type
                })
    return result

# Renvoie la racine de l'arbre des paramètres du fichier en paramètre
def parse_xml(file_path):
    tree = ET.parse(file_path)
    root = tree.getroot()
    return root


# Route permettant de récupérer les résultats d'une simulation défaut liée à une station en particulier grâce à l'ID de la station
@app.route("/api/getBetaSimulations/<index>", methods=['GET'])
def getBetaSimulations(index):
    try: 
        simulation = SimulationsBeta.query.filter(
            func.json_extract(SimulationsBeta.Parameters, '$.user_watershed_id') == index
        ).first()
        
        if simulation is None:
            return jsonify({"Error": "No simulation found for the given index"}), 404

        return jsonify({"results":simulation.Results,"indicators": simulation.Indicators, "watershed_name":simulation.Parameters["watershed_name"]}), 200
    except Exception as e:
        return jsonify({"Error": str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True)