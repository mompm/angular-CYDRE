from datetime import datetime
import json
import time
import uuid
import os
import sys
import pandas as pd
import geopandas as gpd
import pyproj
from shapely.geometry import Point
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import JSON, Column, DateTime, Integer, String, update, func, text
import numpy as np
import libraries.forecast.initialization as INI
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backEnd.api2 import Graph

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:diverse35@localhost/cydre'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

app_root = os.path.dirname(os.path.abspath(__file__))

# Load the stations data
stations = pd.read_csv(os.path.join(app_root, 'data', 'stations.csv'), delimiter=';', encoding='ISO-8859-1')
lambert93_to_wgs84 = pyproj.Transformer.from_crs("EPSG:2154", "EPSG:4326", always_xy=True)
x_wgs84, y_wgs84 = lambert93_to_wgs84.transform(stations["x_outlet"], stations["y_outlet"])
geometry_stations = [Point(xy) for xy in zip(x_wgs84, y_wgs84)]
gdf_stations = gpd.GeoDataFrame(stations, geometry=geometry_stations, crs="EPSG:4326")

class SimulationsBeta(db.Model):
    __tablename__ = 'SimulationsBeta'
    
    SimulationID = db.Column(db.String, primary_key=True)
    Parameters = db.Column(JSON, nullable=False)
    Results = db.Column(JSON, nullable=False)
    Indicators = db.Column(JSON, nullable=True)
    SimulationDate = db.Column(db.DateTime, nullable=False)

def updateSimulationsBeta(station):
    disabled_stations = [
        'J0121510', 'J0621610', 'J2233010', 'J3413030', 'J3514010', 'J3811810', 'J4614010', 'J4902010', 'J5224010',
        'J5412110', 'J5524010', 'J5618320', 'J7355010', 'J7356010', 'J7364210','J7373110', 'J8433010', 'J8502310'
    ]

    if station not in disabled_stations:
        try:
            # Création de l'identifiant de simulation unique
            simulation_id = str(uuid.uuid4())
            params = {
                "user_watershed_id": station,
                "user_horizon": 120,
                "date": datetime.now().strftime('%Y-%m-%d')
            }

            # Enregistrement initial dans la base de données
            new_simulation = SimulationsBeta(
                SimulationID=simulation_id,
                Parameters=params,
                Indicators=[],
                Results={
                    "similarity": {
                        "clusters": {},
                        "similar_watersheds": [],
                        "corr_matrix": {
                            "specific_discharge": {},
                            "recharge": {}
                        },
                        "user_similarity_period": []
                    },
                    "data": {
                        'graph': {},
                        'last_date': None,
                        'first_date': None,
                    },
                    "corr_matrix": {}
                },
                SimulationDate=datetime.now()
            )
            db.session.add(new_simulation)
            db.session.commit()

            # Init Cydre app
            init = INI.Initialization(app_root)
            cydre_app = init.cydre_initialization()
            param_names = ['user_watershed_id', 'user_horizon', 'date']
            param_paths = init.get_parameters_path(param_names)
            init.params.find_and_replace_param(param_paths[0], params.get('user_watershed_id'))
            init.params.find_and_replace_param(param_paths[1], int(params.get('user_horizon')))
            init.params.find_and_replace_param(param_paths[2], str(params.get('date')))
            cydre_app = init.create_cydre_app()
            watershed_name = stations[stations['ID'] == cydre_app.UserConfiguration.user_watershed_id].name.values[0]

            # Run spatial similarity
            cydre_app.run_spatial_similarity(spatial=True)
            clusters_json = cydre_app.Similarity.clusters.to_json()
            similar_watersheds_json = json.dumps(cydre_app.Similarity.similar_watersheds)
            json_path_clusters = '$.similarity.clusters'
            json_path_similar_watersheds = '$.similarity.similar_watersheds'
            stmt = (
                update(SimulationsBeta)
                .where(SimulationsBeta.SimulationID == simulation_id)
                .values({SimulationsBeta.Results: func.json_set(SimulationsBeta.Results, json_path_clusters, clusters_json)})
            )
            db.session.execute(stmt)
            stmt = (
                update(SimulationsBeta)
                .where(SimulationsBeta.SimulationID == simulation_id)
                .values({SimulationsBeta.Results: func.json_set(SimulationsBeta.Results, json_path_similar_watersheds, similar_watersheds_json)})
            )
            db.session.execute(stmt)
            db.session.commit()

            # Run timeseries similarity
            cydre_app.run_timeseries_similarity(cydre_app.Similarity.similar_watersheds)
            corr_matrix = cydre_app.Similarity.correlation_matrix
            for key, value in corr_matrix.items():
                if key == "specific_discharge":
                    specific_discharge = value.to_json(orient='split')
                elif key == "recharge":
                    recharge = value.to_json(orient='split')
            json_path_specific_discharge = '$.similarity.corr_matrix.specific_discharge'
            json_path_recharge = '$.similarity.corr_matrix.recharge'
            json_path_similar_period = '$.similarity.user_similarity_period'
            stmt = (
                update(SimulationsBeta)
                .where(SimulationsBeta.SimulationID == simulation_id)
                .values({SimulationsBeta.Results: func.json_set(SimulationsBeta.Results, json_path_specific_discharge, specific_discharge)})
            )
            db.session.execute(stmt)
            stmt = (
                update(SimulationsBeta)
                .where(SimulationsBeta.SimulationID == simulation_id)
                .values({SimulationsBeta.Results: func.json_set(SimulationsBeta.Results, json_path_recharge, recharge)})
            )
            db.session.execute(stmt)
            stmt = (
                update(SimulationsBeta)
                .where(SimulationsBeta.SimulationID == simulation_id)
                .values({SimulationsBeta.Results: func.json_set(SimulationsBeta.Results, json_path_similar_period, json.dumps(cydre_app.Similarity.user_similarity_period.strftime('%Y-%m-%d').tolist()))})
            )
            db.session.execute(stmt)
            db.session.commit()

            scenarios_grouped, selected_scenarios = cydre_app.select_scenarios(spatial=True, corr_matrix=corr_matrix)
            for key, value in selected_scenarios.items():
                if key == "specific_discharge":
                    specific_discharge = value.to_json(orient='split')
                elif key == "recharge":
                    recharge = value.to_json(orient='split')
            scenarios_grouped_path = '$.scenarios_grouped'
            selected_scenarios_path = '$.selected_scenarios'
            json_path_specific_discharge = selected_scenarios_path + '.specific_discharge'
            json_path_recharge = selected_scenarios_path + '.recharge'
            stmt = (
                update(SimulationsBeta)
                .where(SimulationsBeta.SimulationID == simulation_id)
                .values({SimulationsBeta.Results: func.json_set(SimulationsBeta.Results, scenarios_grouped_path, scenarios_grouped.to_json())})
            )
            db.session.execute(stmt)
            stmt = (
                update(SimulationsBeta)
                .where(SimulationsBeta.SimulationID == simulation_id)
                .values({SimulationsBeta.Results: func.json_set(SimulationsBeta.Results, json_path_specific_discharge, specific_discharge)})
            )
            db.session.execute(stmt)
            stmt = (
                update(SimulationsBeta)
                .where(SimulationsBeta.SimulationID == simulation_id)
                .values({SimulationsBeta.Results: func.json_set(SimulationsBeta.Results, json_path_recharge, recharge)})
            )
            db.session.execute(stmt)
            db.session.commit()

            cydre_app.df_streamflow_forecast, cydre_app.df_storage_forecast = cydre_app.streamflow_forecast()
            results = Graph(cydre_app, watershed_name, stations, cydre_app.date, scenarios_grouped, cydre_app.Similarity.user_similarity_period, cydre_app.Similarity.similar_watersheds, log=True, module=True, baseflow=False, options='viz_plotly')
            app.logger.info('Cydre app and Graph results are initialized and stored')

            graph_results = results.plot_streamflow_projections(module=True)
            json_to_store = json.dumps({
                "graph": graph_results['graph'],
                "first_date": graph_results['first_date'],
                "last_date": graph_results['last_date'],
                'first_observation_date': graph_results['first_observation_date'],
                'last_observation_date': graph_results['last_observation_date'],
                'first_prediction_date': graph_results['first_prediction_date'],
                'last_prediction_date': graph_results['last_prediction_date']
            })
            stmt = (
                update(SimulationsBeta)
                .where(SimulationsBeta.SimulationID == simulation_id)
                .values({
                    SimulationsBeta.Results: func.json_set(
                        SimulationsBeta.Results,
                        text("'$.data'"), json_to_store
                    )
                })
            )
            db.session.execute(stmt)

            mod10_string = {
                "type": "1/10 du module",
                "value": graph_results['m10'],
                "color": "#Ff0000",
                "results": {
                    'proj_values': graph_results['proj_values'],
                    'ndays_before_alert': graph_results['ndays_before_alert'],
                    'ndays_below_alert': graph_results['ndays_below_alert'],
                    'prop_alert_all_series': graph_results["prop_alert_all_series"],
                    'volume50': graph_results['volume50'],
                    'volume10': graph_results['volume10'],
                    'volume90': graph_results['volume90'],
                }
            }

            simulation = SimulationsBeta.query.filter_by(SimulationID=simulation_id).first()
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
            db.session.commit()

            corr_matrix = pd.DataFrame(cydre_app.scenarios_grouped)
            df = corr_matrix.reset_index()
            df.columns = ['Year', 'ID', 'Coeff']
            df['Coeff'] = df['Coeff'].round(2)
            df['ID'] = df['ID'].map(gdf_stations.set_index('ID')['name'].to_dict())
            df['ID'] = df['ID'].replace({np.nan: 'Unknown Station'})
            df = df.astype({'Year': 'int', 'Coeff': 'float'})
            corr_matrix = df.to_dict(orient='records')
            stmt = (
                update(SimulationsBeta)
                .where(SimulationsBeta.SimulationID == simulation_id)
                .values({SimulationsBeta.Results: func.json_set(SimulationsBeta.Results, '$.corr_matrix', json.dumps(corr_matrix))})
            )
            db.session.execute(stmt)
            db.session.commit()
        except Exception as e:
            print(e)
            return jsonify({'Error': str(e)})

def updateDatabase():
    with app.app_context():
        db.session.execute(text('TRUNCATE TABLE SimulationsBeta'))
        db.session.commit()
        for index, station in stations.iterrows():
            updateSimulationsBeta(station['ID'])

def main():
    updateDatabase()

if __name__ == "__main__":
    main()
