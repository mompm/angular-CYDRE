# -*- coding: utf-8 -*-
"""
Created on Mon Oct  9 17:14:59 2023

@author: nicol
"""

import flask
from flask_cors import CORS, cross_origin
import pandas as pd
import plotly.express as px


# --- Chargement des données ---

# Exemple 1 : débits d'un cours d'eau
df_scatter = pd.read_csv("./data/scatter_plot.csv", delimiter=",", index_col="t")
df_scatter.index = pd.to_datetime(df_scatter.index)

# Exemple 2 : tableau de corrélation des années/bassins
df_table = pd.read_csv("./data/table.csv", delimiter=",", index_col=0)

# Exemple 3 : localisation des différentes stations de débits
df_map = pd.read_csv("./data/map.csv", delimiter=";")


# --- Initialisation de Flask ---

app = flask.Flask(__name__)
cors = CORS(app)
app.config['CORS_HEADERS'] = 'Content-Type'


# --- Affichage des fichiers XML ---

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


# --- Génération des sorties python ---

# -- Exemple 1 : Courbe simple --

@app.route('/osur/display_scatter_plot', methods=['GET'])
@cross_origin()
def plot_scatter(df_scatter):
        
    fig = px.line(
        x=df_scatter.index,
        y=df_scatter["Q"],
        template="simple_white",
        labels={"x": "Date", "y": "Débit (m3/s)"},
    )

    fig.update_traces(line=dict(width=1, color='#5593c8'))

    fig.update_layout(
      title="Test de l'affichage d'un graphique simple",
      title_x=0.5,
      plot_bgcolor="rgba(0,0,0,0)",
      paper_bgcolor="rgba(0,0,0,0)")
        
    return fig

# -- Exemple 2 : Tableau au format json --

@app.route('/osur/display_table', methods=['GET'])
@cross_origin()
def table(df_table):
    return df_table.to_json(orient='split')

# -- Exemple 3 : Carte de la localisation des stations de mesure des débits --

@app.route('/osur/display_map', methods=['GET'])
@cross_origin()
def plot_map(df_map):
    
    fig = px.scatter_mapbox(df_map, lon=df_map['x_outlet'], lat=df_map['y_outlet'],
                            hover_name = df_map["name"])
    
    # Update the layout
    fig.update_layout(mapbox_style="open-street-map",
                      mapbox_center={"lat": 48.2141667, "lon": -2.9424167},
                      mapbox_zoom=6.8,
                      paper_bgcolor="rgba(0,0,0,0)",
                      margin={"l": 0, "r": 0, "t": 0, "b": 0})
    
    return fig


# --- Run du serveur Dash ---
if __name__ == '__main__':
    app.run(host='localhost')