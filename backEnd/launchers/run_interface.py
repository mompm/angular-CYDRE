# -*- coding: utf-8 -*-
"""
Created on Mon Aug 14 15:27:02 2023

@author: Nicolas Cornette

Interface Dash, no longer used 
"""

# Python modules
import base64
from datetime import datetime
import io
import json
import os
import sys
from flask import jsonify
import pandas as pd
import geopandas as gpd
import pyproj
from shapely.geometry import Point
import plotly.tools as tls
import matplotlib
matplotlib.use('agg')

from datetime import datetime

# Plotly, Dash
import dash
from dash import Dash, dcc, Input, State, Output, callback
import dash_bootstrap_components as dbc
from dash_bootstrap_templates import load_figure_template

current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

# Cydre modules
from setup_cydre_path import setup_cydre_path
app_root = setup_cydre_path()

from libraries.interface.layout import *
from libraries.interface.plots import * 
from libraries.interface.plots import *
from libraries.interface.plots import *
from libraries.interface.cydre_results import *
from libraries.interface.style import *
import libraries.forecast.initialization as IN
import libraries.postprocessing.outputs as OU


#%% PREPARATION

# Cydre results path
output_path = os.path.join(app_root,"outputs","projections")

# Initialize Cydre application, loading input parameters, datasets, etc.
init = IN.Initialization(app_root)
cydre_app = init.cydre_initialization()
data_path = os.path.join(app_root, 'data')
hydro_path = os.path.join(data_path, 'hydrometry', 'discharge')
surfex_path = os.path.join(data_path, 'climatic', 'surfex')
piezo_path = os.path.join(data_path, 'piezometry')

# Hydrological stations
stations = pd.read_csv(os.path.join(data_path, 'stations.csv'), delimiter=';', encoding='ISO-8859-1')
lambert93_to_wgs84 = pyproj.Transformer.from_crs("EPSG:2154", "EPSG:4326", always_xy=True)
x_wgs84, y_wgs84 = lambert93_to_wgs84.transform(stations["x_outlet"], stations["y_outlet"])
geometry_stations = [Point(xy) for xy in zip(x_wgs84, y_wgs84)]
gdf_stations = gpd.GeoDataFrame(stations, geometry=geometry_stations, crs="EPSG:4326")
gdf_stations['hydro_link'] = gdf_stations['ID'].apply(lambda id: f"https://www.hydro.eaufrance.fr/sitehydro/{id}/fiche")
gdf_stations['href_hydro'] = '<a href="' + gdf_stations.hydro_link + '">' + gdf_stations.hydro_link + "</a>"

# Watersheds boundaries
gdf_watersheds = gpd.read_file(os.path.join(data_path, 'watersheds.shp'))
gdf_watersheds = gdf_watersheds.set_index('index')

# Piezometric stations
piezo_stations = pd.read_csv(os.path.join(app_root, 'data', 'piezometry', 'stations.csv'), delimiter=';', encoding='ISO-8859-1')
geometry_piezometry = [Point(xy) for xy in zip(piezo_stations['X_WGS84'], piezo_stations['Y_WGS84'])]
gdf_piezometry = gpd.GeoDataFrame(piezo_stations, geometry=geometry_piezometry, crs="EPSG:4326")

# Initialisation de la liste déroulante et stockage dans l'état
options = [{'label': ID+' - '+label, 'value': ID} for label, ID in zip(gdf_stations['station_name'], gdf_stations['station_name'])]

default_selected_watershed = 'J0014010'
watershed_store = 'J0014010'

list_of_disabled_options = [
    'J0121510', 'J0323010', 'J1004520', 'J2233010', 'J2233020', 'J2605410', 'J3601810',
    'J3631810', 'J3821810', 'J3821820', 'J4313010', 'J4614010', 'J4623020', 'J4742010', 'J4902010', 'J5224010', 'J5402120'
    'J5412110', 'J7083110', 'J7114010', 'J7824010', 'J7833010', 'J7973010', 'J8202310', 'J8363110', 'J8443010', 'J8502310', 'J8813010'
    ]


#%% Initialization and configuration of the application
load_figure_template("SOLAR")

app = Dash(__name__, 
           title='Cydre',
           meta_tags=[{"name": "watershed-sheet", "content": "width=device-width, initial-scale=1"}],
           external_stylesheets=[dbc.themes.YETI])
app._favicon = os.path.join(app_root, 'libraries', 'interface', 'assets', "icon.ico")
app.config.suppress_callback_exceptions = True
app.layout = main_layout()


#%% APP CALLBACKS
# functions that are automatically called by Dash whenever an input component's property changes, in order to update some property in another component (the output).

# Callback pour mettre à jour la variable global store_watershed ( permet d'avoir garder le meme watershe sur les pages)
@app.callback(
    Output('stored', 'children'),
    [Input('watershed', 'value')]
)
def update_store_data(value):
    global watershed_store
    watershed_store = value
    return None     


# Callback pour déterminer la barre de navigation en fonction de l'URL
@app.callback(
    Output('navbar-content', 'children'),
    [Input('url', 'pathname')]
)
def display_navbar(pathname):
    if pathname == '/':
        return create_principal_navbar("Accueil")
    elif pathname == '/fiches':
        return create_other_navbar("FichesSite")
    elif pathname == '/simulateur':
        return create_other_navbar("SimulateurCydre")
    elif pathname == '/about':
        return create_other_navbar("AboutUs")
    else:
        return create_principal_navbar("Accueil")


# Callback pour mettre à jour le contenu en fonction de l'URL
@app.callback(
    Output('page-content', 'children'),
    [Input('url', 'pathname')]
)
def display_page(pathname):
    if pathname == '/simulateur':
        return simulation_cydre_layout(gdf_stations, watershed_store)
    elif pathname == '/about':
         return  about_layout()
    elif pathname == "/fiches":
        return fiche_site_layout(gdf_stations, watershed_store)
    else:
        return home_layout()


# Display the content of the active tab
@callback(
    Output("tab-content", "children"),
    Input("tabs", "active_tab"),
    )

def update_tab_content(active_tab):
    return render_tab_content(active_tab)


# Update HydroPortail URL with the selected hydrological station
@app.callback(
    Output("access-link", "href"),
    Input("watershed", "value")
)
def update_hydroportail_url(selected_watershed):
    if selected_watershed:
        # Construisez l'URL avec l'identifiant du bassin versant sélectionné
        url = f"https://www.hydro.eaufrance.fr/sitehydro/{selected_watershed}/fiche"
        return url
    else:
        # Si aucun bassin versant n'est sélectionné, laissez l'URL vide
        return "" 
    

# Update ADES URL with the selected ades station
@app.callback(
    Output("ades-link", "href"),
    Input("watershed", "value")
    )
def update_ades_url(selected_watershed):
    if selected_watershed:
        old_bss_code = cydre_app.watersheds[selected_watershed]['piezometry']['old_bss_id']
        url = f"https://ades.eaufrance.fr/Fiche/PtEau?Code={old_bss_code}"
        return url
    else:
        return ""
    

# Add modal informations when the user clicked on a button
@app.callback(
    Output("modal-xl", "is_open"),
    Input("info-test", "n_clicks"),
    State("modal-xl", "is_open"),
    )
def toggle_modal(n1, is_open):
    if n1:
        return not is_open
    return is_open


# Vizualise the forecast plots only when the user clicked on the button
@app.callback(
    Output('forecast_streamflow', 'style'),
    [Input('run-button', 'n_clicks')],
    prevent_initial_call=True
)
def update_graph_visibility(n_clicks):
    # Vérifie si le bouton a été cliqué
    if n_clicks:
        return {'width': '70%', 'height': 600, 'display': 'block'}  # Afficher le graphique après le clic sur le bouton
    else:
        return {'width': '70%', 'height': 600, 'display': 'none'}  # Masquer le graphique par défaut


# Display the Regional-scale map of the watersheds 
@callback(
    Output("regional_map", "figure"),
    Input("watershed", "value"),
    persistent=True,
    )
def update_regional_map(watershed):
    return regional_map(gdf_stations, gdf_watersheds, gdf_piezometry, watershed)


# Select the watershed by clicking directly on the Regional-scale map
@callback(
    Output('watershed', 'value'),
    Input('regional_map', 'clickData'),
    )
def update_watershed_selection(clickData):
    if clickData is not None and 'points' in clickData:
        point_index = clickData['points'][0]['pointIndex']
        clicked_value = options[point_index]['value']
        if clicked_value not in list_of_disabled_options:
            return clicked_value
    else:
        return default_selected_watershed


# Display the Watershed-scale map
@callback(
    Output("regional_map2", "srcDoc"),
    Input("watershed", "value"),
    persistent=True,
    )
def update_watershed_map(watershed):
    m = watershed_map(gdf_stations, gdf_watersheds, gdf_piezometry, watershed)
    return m._repr_html_()


# Callback débits sur l'ensemble de la période
@app.callback(
    Output("global-hydrograph-container", "children"),
    [Input("hydrograph-scale", "on")],
    [Input("watershed", "value")],
    [Input('valider_graphs', 'n_clicks')],
    [Input('check_graphs', 'value')],
    persistent=True,
)
def update_hydrograph(on, watershed, n_clicks, value):
    if n_clicks > 0 :
        graphs = []
        for hydro in value:
            if hydro == "g1":
                watershed_name = gdf_stations[gdf_stations["ID"] == watershed]['station_name'].values[0]
                fig = hydrograph(on, watershed, hydro_path, watershed_name)
                graph_element = dcc.Graph(figure=fig, style=style_hydrograph)
                graphs.append(graph_element)
        return graphs
    else :
        return None
    
    
# Callback débits à l'échelle saisonnière
@app.callback(
    Output("seasonal-hydrograph", "children"),
    [Input("watershed", "value")],
    [Input("event", "value")],
    [Input('valider_graphs', 'n_clicks')],
    [Input('check_graphs', 'value')],
    persistent=True,
    )
def update_seasonal_hydrograph(watershed, event, n_clicks, value):
    if n_clicks > 0 :
        graphs = []
        for hydro in value:
            if hydro == "g4":
                fig = seasonal_hydrograph(watershed, event, hydro_path)
                graph_element = dcc.Graph(figure=fig, style=style_seasonal_plot_right)
                graphs.append(graph_element)
        return graphs
    else :
        return None


# Callback température à l'échelle saisonnière
@app.callback(
    Output("seasonal-temperature", "children"),
    [Input("watershed", "value")],
    [Input("event", "value")],
    [Input('valider_graphs', 'n_clicks')],
    [Input('check_graphs', 'value')],
    persistent=True,
    )
def update_seasonal_temperature(watershed, event, n_clicks, value):
    if n_clicks > 0 :
        graphs = []
        for hydro in value:
            if hydro == "g2":
                temperature_path = os.path.join(surfex_path, "temperature")
                fig = seasonal_temperature(watershed, event, temperature_path)
                graph_element = dcc.Graph(figure=fig, style=style_seasonal_plot_left)
                graphs.append(graph_element)
        return graphs
    else :
        return None


# Callback precipitation à l'échelle saisonnière
@app.callback(
    Output("seasonal-precipitation", "children"),
    [Input("watershed", "value")],
    [Input("event", "value")],
    [Input('valider_graphs', 'n_clicks')],
    [Input('check_graphs', 'value')],
    persistent=True,
    )
def update_seasonal_precipitation(watershed, event,n_clicks, value):
    if n_clicks > 0 :
        graphs = []
        for hydro in value:
            if hydro == "g3":
                precipitation_path = os.path.join(surfex_path, "precipitation")
                fig = seasonal_precipitation(watershed, event, precipitation_path)
                graph_element = dcc.Graph(figure=fig, style=style_seasonal_plot_right)
                graphs.append(graph_element)
        return graphs
    else :
        return None


# Callback profondeur de nappe à l'échelle saisonnière
@app.callback(
    Output("seasonal-piezometric", "children"),
    [Input("watershed", "value")],
    [Input("event", "value")],
    [Input('valider_graphs', 'n_clicks')],
    [Input('check_graphs', 'value')],
    persistent=True,
    )
def update_seasonal_piezometric(watershed, event, n_clicks, value):
    if n_clicks > 0 :
        graphs = []
        for hydro in value:
            if hydro == "g5":
                piezo_name = gdf_stations[gdf_stations["ID"] == watershed]['BSS_ID'].values[0]
                fig = seasonal_piezometric(watershed, event, piezo_path, piezo_name)
                graph_element = dcc.Graph(figure=fig, style=style_seasonal_plot_right)
                graphs.append(graph_element)
        return graphs
    else :
        return None


@app.callback(
    Output('hydrograph-scale','style'),
    Output('hydrograph-scale-text', 'style'),
    Output("event", 'style'),
    Output("paragraphe_hydrograph","style"),
    Output("title_seasonal_graph","style"),
    Output("dropdown_annee_text","style"),
    [Input('valider_graphs', 'n_clicks')],
    [Input('check_graphs', 'value')],
)
def update_style_suivie_eau(n_clicks, value):
    scale = {'display': 'none'}
    scale_text = {'display': 'none'}
    event =  style_dropdown_annee_invisible
    paragraph_hydro = style_parapgraphe_with_padding_invisible 
    title_seasonal = {'display': 'none'}
    event_text = {'display': 'none'}
    if n_clicks > 0:
        for graphs in value :
            if graphs == "g1":
                scale = {'display': 'block'}
                scale_text = {'display': 'block', "textAlign": "center"}
            if (graphs =="g2") or (graphs =="g3") or (graphs == "g4") or (graphs == "g5"):
                paragraph_hydro = style_parapgraphe_with_padding_visible 
                title_seasonal = {'display': 'block' ,"textAlign": "center", 'padding-bottom':'10px'}
                event_text = {'display': 'block' ,"textAlign": "center", 'padding-bottom':'5px'}
                event = style_dropdown_annee_visible
        return scale , scale_text , event , paragraph_hydro , title_seasonal , event_text
    else:
        return scale , scale_text , event, paragraph_hydro , title_seasonal , event_text


# Callback sur les cartes NSE
@callback(
    Output("nselog-map", "figure"),
    Input("watershed", "value"),
    persistent=True,
    )
def update_nselog_map(watershed):
    return nselog_map(watershed, cydre_app)


# Layout cydre results
@app.callback(
    Output('cydre-results', 'children'),
    Output('cydre-loading', 'children'),
    Input('run-button', 'n_clicks'),
    [State("watershed", "value"), State("points-slider", "value"), State("my-date-picker-single", "date")],
    prevent_initial_call=True,
)
def update_cydre_results_display(n_clicks, watershed_value, slider_value, simulation_date):
    results, _ = update_cydre_simulation(watershed_value, slider_value, simulation_date)
    return results, None
        
def extract_plotly_data(fig):
    """
    Extract data and layout from a Plotly figure object.
    
    Parameters:
    fig (plotly.graph_objs.Figure): The Plotly figure object to extract data from.

    Returns:
    tuple: A tuple containing the data and layout of the Plotly figure.
    """
    plotly_json = fig.to_plotly_json()

    # Convert numpy arrays to lists
    def convert(obj):
        if isinstance(obj, np.ndarray):
            return np.nan_to_num(obj, nan=0.0).tolist()         
        if isinstance(obj, dict):
            return {k: convert(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [convert(i) for i in obj]
        return obj

    data = convert(plotly_json['data'])
    layout = convert(plotly_json['layout'])
    return data, layout


#%% RUN CYDRE APPLICATION

def update_cydre_simulation(watershed_value, slider_value, simulation_date):
    param_names = ['user_watershed_id', 'user_horizon', 'date']
    param_paths = init.get_parameters_path(param_names)
     
    init.params.find_and_replace_param(param_paths[0], watershed_value)
    init.params.find_and_replace_param(param_paths[1], int(slider_value))
    init.params.find_and_replace_param(param_paths[2], str(simulation_date))

    cydre_app = init.create_cydre_app()


    # Run cydre seasonal forecast
    streamflow_fig_data, results = run_cydre(cydre_app)
    typology_fig = typology_map(cydre_app.Similarity.similar_watersheds, gdf_stations)
    # Extract data from Plotly figure
    streamflow_datasets, streamflow_layout = extract_plotly_data(streamflow_fig_data)
    # Get correlation matrix
    corr_matrix = pd.DataFrame(cydre_app.scenarios_grouped)
    df = corr_matrix.reset_index()
    df.columns = ['Year', 'ID', 'Coeff']
    df['Coeff'] = df['Coeff'].round(2)
    df['ID'] = df['ID'].map(gdf_stations.set_index('ID')['name'].to_dict())

    # Convert int64 to int for JSON serialization
    df = df.astype({'Year': 'int', 'Coeff': 'float'})

    # Format the results into a dictionary
    response = {
        'proj_values': {
            'Q50': float(results.proj_values.Q50),
            'Q10': float(results.proj_values.Q10),
            'Q90': float(results.proj_values.Q90)
        },
        'ndays_before_alert':{
            'Q50': int(results.ndays_before_alert_Q50),
            'Q90': int(results.ndays_before_alert_Q90),
            'Q10': int(results.ndays_before_alert_Q10),
        },
        'ndays_below_alert': {
            'Q50': int(results.ndays_below_alert.Q50),
            'Q90': int(results.ndays_below_alert.Q90),
            'Q10': int(results.ndays_below_alert.Q10)
        },
        'prop_alert_all_series': float(results.prop_alert_all_series),
        'volume50': int(results.volume50),
        'volume10': int(results.volume10),
        'last_date': results.projection_period[-1].strftime("%d/%m/%Y"),
        'first_date': results.simulation_date.strftime('%Y-%m-%d'),
        'corr_matrix': df.to_dict(orient='records'),
        # 'typologyDatasets': typology_fig['datasets'],  # Utiliser les données de typology_map
        # 'typologyLabels': typology_fig['labels'],      # Utiliser les labels de typology_map
        # 'typologyOptions': typology_fig['layout'],    # Utiliser les options de typology_map
        'streamflow_datasets': streamflow_datasets,
        'streamflow_layout': streamflow_layout
        # 'streamflowOptions': streamflow_fig_data['layout'],  # Options de mise en page
        # 'scale': False
    }
    return response


def typology_map(similar_watersheds, gdf_stations):
    gdf_subset = gdf_stations[gdf_stations["ID"].isin(similar_watersheds)]
    
    # Extraire les données nécessaires
    typology_data = {
        'datasets': [{
            'label': 'Similar Watersheds',
            'data': [{
                'lat': row.geometry.y,
                'lon': row.geometry.x,
                'name': row.station_name
            } for idx, row in gdf_subset.iterrows()]
        }],
        'labels': gdf_subset['station_name'].tolist(),
        'options': {
            'mapbox': {
                'style': "open-street-map",
                'center': {"lat": 48.2141667, "lon": -2.9424167},
                'zoom': 6.8
            },
            'layout': {
                'paper_bgcolor': "rgba(0,0,0,0)",
                'margin': {"l": 0, "r": 0, "t": 0, "b": 0}
            }
        }
    }
        
    return typology_data

def run_cydre(cydre_app):
    
    """
    Run the Cydre forecast application and return JSON data with results.
    """
    
    # Run the Cydre application
    cydre_app.run_spatial_similarity(spatial=True)
    cydre_app.run_timeseries_similarity()
    cydre_app.select_scenarios(spatial=True)
    df_streamflow_forecast, df_storage_forecast = cydre_app.streamflow_forecast()

    watershed_name = stations[stations['ID'] == cydre_app.UserConfiguration.user_watershed_id].name.values[0]
    results = OU.Outputs(cydre_app, output_path, watershed_name, stations, cydre_app.date,
                         log=True, module=True, baseflow=False, options='viz_plotly')
    streamflow_fig = results.streamflow_fig

    
    return streamflow_fig, results

#%% RUN APPLICATION

if __name__ == "__main__":
    app.enable_dev_tools(dev_tools_props_check=False)
    app.run(debug=True)
    #app.run_server(host='0.0.0.0', port=4380, debug=True, ssl_context=(os.path.join(app_root, 'mycert.crt'), os.path.join(app_root, 'mycert.key')))
    #app.run_server(host='0.0.0.0')#, config={"displayModeBar": False, "staticPlot": False, "scrollZoom": False, "displaylogo": False, "modeBarButtonsToRemove": ["zoom2d", "lasso2d", "select2d", "sendDataToCloud", "resetScale2d"]})
