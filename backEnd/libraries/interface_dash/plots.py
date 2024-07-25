# -*- coding: utf-8 -*-
"""
Created on Tue Mar 26 10:56:29 2024

@author: nicol
"""

import os
import math
import numpy as np
import pandas as pd
import geopandas as gpd
import seaborn as sns
import matplotlib as mpl 
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import plotly.express as px
import plotly.graph_objects as go
import folium
import pyproj
from shapely.geometry import MultiPolygon, Polygon


# Common parameters
months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
TICKVALS = [f"{month:02d}-01" for month in range(1, 13)]
TICKTEXT = [f"{months[month-1]}" for month in range(1, 13)]

seasonal_subtitle_params = {
    "xref": "paper",
    "yref": "paper",
    "x": 0.5,
    "y": 1.15,
    "showarrow": False,
    "font": {"family": "Segoe UI Semilight Italic", "size": 18, "color": "#999"}
}

seasonal_median_line = {
    'color' : 'black',
    'width' : 1.5,
    'dash' : 'dot'
    }

seasonal_variability = {
    'fill' : 'toself',
    'fillcolor' : 'rgba(183, 223, 255, 0.3)',
    'line' : dict(color='rgba(0, 0, 0, 0)'),
    'hoverinfo' : 'none',
    }

seasonal_x_axes = {
    'type' : "category", 
    'tickvals' : TICKVALS, 
    'ticktext' : TICKTEXT, 
    'tickfont' : dict(size=14, family='Segoe UI Semibold', color='black'),
    'gridwidth' : 0.01,
    'gridcolor' : 'rgba(0,0,0,0.1)'
    }

seasonal_y_axes = {
    'showticklabels' : True,
    'tickfont' : dict(size=14, family='Segoe UI Semibold', color='black'),
    'gridwidth' : 0.01,
    'gridcolor' : 'rgba(0,0,0,0.1)',
    }

seasonal_y_axes_font = dict(size=16, color="black", family='Segoe UI Semibold')

seasonal_title_font = {'family': "Segoe UI Semibold", 'size': 22, 'color': "black"}

seasonal_layout_params = {
    'margin' : dict(t=125),
    'title_x' : 0.5,
    'hovermode' : "x unified",
    'plot_bgcolor' : "rgba(0,0,0,0)",
    'paper_bgcolor' : "rgba(0,0,0,0)",
    'legend' : dict(orientation="h", yanchor="top", y=1.1, xanchor="right", x=1)
    }

seasonal_footer_params = {
    'xref' : "paper",
    'yref' : "paper",  # Positionnement relatif par rapport au papier
    'x' : 0.5,
    'y' : -0.15,  # Position horizontale au milieu, position verticale en dessous de la figure
    'showarrow' : False,  # Pas de flèche pour indiquer la source
    'font' : dict(size=14, color="gray", family='Segoe UI Semilight'),  # Taille et couleur du texte
    }

palette = sns.color_palette("Set1", n_colors=10)


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


def regional_map(gdf_stations, gdf_watersheds, gdf_piezometry, watershed_id):
    
    fig = go.Figure()

    # Add the watersheds boundaries
    for index, row in gdf_watersheds.iterrows():
        geometry = row['geometry']
        polygon_coords = geometry.exterior.coords.xy
        polygon_lat = list(polygon_coords[1])
        polygon_lon = list(polygon_coords[0])

        # Define opacity for the current polygon
        opacity = 0.5 if index == watershed_id else 0.1
        
        # Define fill color for the current polygon
        fill_color = 'rgba(255, 0, 0, ' + str(opacity) + ')' if index == watershed_id else 'rgba(0, 0, 0, ' + str(opacity) + ')'

        # Add the polygon to the figure
        fig.add_trace(go.Scattermapbox(
            lat=polygon_lat,
            lon=polygon_lon,
            mode="lines",
            line=dict(width=0.8, color='#3E88A6'),
            name=str(index),
            fill='toself',
            fillcolor=fill_color,
            hoverinfo='skip',
        ))
        
    # Add the associated hydrological stations
    fig.add_trace(go.Scattermapbox(
        lat=gdf_stations.geometry.y,
        lon=gdf_stations.geometry.x,
        mode='markers',
        marker=dict(
            size=5,
            color="#3E88A6",
        ),
        hoverinfo='text',
        hovertext=gdf_stations['ID'].astype(str) + " - " + gdf_stations['station_name'],
        name="Hydrological stations",
    ))

    # Add the associated piezometric stations
    fig.add_trace(go.Scattermapbox(
        lat=gdf_piezometry.geometry.y,
        lon=gdf_piezometry.geometry.x,
        mode='markers',
        marker=dict(
            size=5,
            color="purple",
        ),
        hoverinfo='text',
        hovertext=gdf_piezometry['Identifiant BSS'].astype(str) + " - " + gdf_piezometry['Nom'],
        name="Piezometry stations",
    ))

    fig.update_layout(mapbox_style="open-street-map",
                      mapbox_center={"lat": 48.2141667, "lon": -2.9424167},
                      mapbox_zoom=6.8,
                      paper_bgcolor="rgba(0,0,0,0)",
                      margin={"l": 0, "r": 0, "t": 0, "b": 0},
                      showlegend=False,
                      hoverlabel=dict(font={'family': "Segoe UI Semibold", 'size': 13}))

    return fig


def watershed_map(gdf_stations, gdf_watersheds, gdf_piezometry, watershed_id):
    
    # Subset with the selected watershed
    gdf_watershed = gdf_watersheds[gdf_watersheds.index == watershed_id]
    gdf_station = gdf_stations[gdf_stations["ID"] == watershed_id]
    BSS_id = gdf_station.BSS_ID.values[0]
    gdf_piezo = gdf_piezometry[gdf_piezometry["Identifiant BSS"] == BSS_id]
    
    # Create a folium map at the watershed-scale
    m = folium.Map(location=[48.2141667, -2.9424167], zoom_start=8)
    
    # Add the watersheds boundaries
    folium.GeoJson(
        gdf_watershed,
        name="Watershed boundary",
        style_function=lambda feature: {
            'fillColor': 'transparent',
            'color': '#3E88A6',
            'weight': 2,
        }
    ).add_to(m)
    
    
    bounds = m.get_bounds()
    m.fit_bounds(bounds)
    
    # Add the hydrological station
    folium.GeoJson(
        gdf_station,
        name="Hydrological station",
        marker=folium.CircleMarker(radius=7, fill_color="#38BFFF", fill_opacity=0.4, color="black", weight=1),
        tooltip=folium.GeoJsonTooltip(fields=["ID", "station_name", "BSS_name"], aliases=["Identifiant", "Nom de la station hydrologique", "Nom de la station piézométrique"],
                                      style="font-size: 10px; color: black"),
         highlight_function=lambda x: {"fillOpacity": 0.8},
    ).add_to(m)
    
    # Add the piezometric station
    folium.GeoJson(
        gdf_piezo,
        name="BSS stations",
        marker=folium.CircleMarker(radius=7, fill_color="#D800A0", fill_opacity=0.4, color="black", weight=1),
        tooltip=folium.GeoJsonTooltip(fields=["Identifiant BSS"], aliases=["Identifiant", ],
                                      style="font-size: 10px; color: black"),
        highlight_function=lambda x: {"fillOpacity": 0.8},
    ).add_to(m)
        
    return m


def hydrograph(on, watershed, hydro_path, watershed_name):
    
    # Read data
    if watershed is not None:
        df = pd.read_csv(os.path.join(hydro_path, watershed+'.csv'), delimiter=',')
        df = df.set_index('t')
    
    # Logarithmic-scale
    if on:
        fig = px.line(
            x=df.index,
            y=df["Q"],
            template="simple_white",
            labels={"x": "Date", "y": "Débit (m3/s)"},
            log_y=True  # Définir l'échelle logarithmique
        )
    
    # Linear-scale
    else:
        fig = px.line(
            x=df.index,
            y=df["Q"],
            template="simple_white",
            labels={"x": "Date", "y": "Débit (m3/s)"}
        )
    
    # Modifiy lines format
    fig.update_traces(line=dict(width=1, color='#006CD8'))

    # Modify layout
    fig.update_layout(
      title={
        'text': "Débits journaliers mesurés à la station hydrologique",
        'font': {'family': "Segoe UI Semibold", 'size': 22, 'color': "black"},
        },
      title_x=0.5,
      plot_bgcolor="rgba(0,0,0,0)",
      paper_bgcolor="rgba(0,0,0,0)"
      )
    
    # Subtitle
    fig.add_annotation(
        text=f"{str(watershed_name)} [{str(watershed)}]",
        xref="paper", yref="paper",
        x=0.5, y=1.1,
        showarrow=False,
        font=dict(family="Segoe UI Semilight Italic", size=18, color="#999")
    )
        
    return fig


def seasonal_hydrograph(watershed, event, hydro_path):
    
    # Read timeseries data
    if watershed is not None:
        df = pd.read_csv(os.path.join(hydro_path, watershed+'.csv'), delimiter=',')
        df['t'] = pd.to_datetime(df['t'])
        df = df.set_index('t')
        df['year'] = pd.DatetimeIndex(df.index).year
        df['daily'] = df.index.strftime('%m-%d')
    
    # Automatically select the year to be displayed
    df_events = df[df['year'].isin(event)]
    
    # Seasonal statistics
    q10 = df.groupby('daily')['Q'].quantile(0.1)
    q50 = df.groupby('daily')['Q'].median()
    q90 = df.groupby('daily')['Q'].quantile(0.9)
        
    # Plots
    fig = go.Figure()
    
    # Median values
    fig.add_trace(go.Scatter(
        x = q10.index,
        y = q50,
        name = f"moyenne [{df['year'][0]} - {df['year'][-1]}]",
        line = seasonal_median_line,
        ))
    
    # Interannual variability values
    fig.add_trace(
        go.Scatter(
            x = q10.index.tolist() + q10.index[::-1].tolist(),
            y = q10.tolist() + q90[::-1].tolist(),
            name = f"variabilité [{df['year'][0]} - {df['year'][-1]}]",
            **seasonal_variability,
        ))
    
    # Add selected years    
    for i, year in enumerate(event):
        df_event = df_events[df_events['year'] == year]
        color_hex = mcolors.to_hex(palette[i])
        fig.add_trace(
            go.Scatter(x=df_event['daily'], y=df_event['Q'], mode="lines", name=str(year),
                       line=dict(color=color_hex, width=1.5))  # Couleur spécifiée pour chaque année
        )
    
    fig.update_xaxes(**seasonal_x_axes)
    fig.update_yaxes(title=dict(text="Débit de cours d'eau [m3/s]", font=seasonal_y_axes_font),
                     type = "log",
                     exponentformat = "power",
                     **seasonal_y_axes)
    fig.update_layout(
        title={
          'text': f"Débits de cours d'eau [{watershed}]",
          'font': seasonal_title_font,
          },
        **seasonal_layout_params
      )
    fig.add_annotation(
         text= f"Mis à jour le : {df.index[-1].strftime('%d-%m-%Y')}",
         **seasonal_subtitle_params
    )
    fig.add_annotation(
        text="Source : DREAL Bretagne",
        **seasonal_footer_params
    )
    
    return fig


def seasonal_temperature(watershed, event, temperature_path):
    
    # Read timeseries data
    if watershed is not None:
        df = pd.read_csv(os.path.join(temperature_path, watershed+'.csv'), delimiter=',')
        df['t'] = pd.to_datetime(df['t'])
        df = df.set_index('t')
        df['year'] = pd.DatetimeIndex(df.index).year
        df['daily'] = df.index.strftime('%m-%d')
    
    # Automatically select the year to be displayed
    df_events = df[df['year'].isin(event)]
    
    # Seasonal statistics
    q10 = df.groupby('daily')['Q'].quantile(0.1)
    q50 = df.groupby('daily')['Q'].median()
    q90 = df.groupby('daily')['Q'].quantile(0.9)
        
    # Plots
    fig = go.Figure()
    
    # Median values
    fig.add_trace(go.Scatter(
        x = q10.index,
        y = q50,
        name = f"moyenne [{df['year'][0]} - {df['year'][-1]}]",
        line = seasonal_median_line,
        ))
    
    # Interannual variability values
    fig.add_trace(
        go.Scatter(
            x = q10.index.tolist() + q10.index[::-1].tolist(),
            y = q10.tolist() + q90[::-1].tolist(),
            name = f"variabilité [{df['year'][0]} - {df['year'][-1]}]",
            **seasonal_variability,
        ))
    
    # Add selected years    
    for i, year in enumerate(event):
        df_event = df_events[df_events['year'] == year]
        color_hex = mcolors.to_hex(palette[i])
        fig.add_trace(
            go.Scatter(x=df_event['daily'], y=df_event['Q'], mode="lines", name=str(year),
                       line=dict(color=color_hex, width=1.5))  # Couleur spécifiée pour chaque année
        )
    
    fig.update_xaxes(**seasonal_x_axes)
    fig.update_yaxes(title=dict(text="Température de l'air [°C]", font=seasonal_y_axes_font),
                     **seasonal_y_axes)
    fig.update_layout(
        title={
          'text': f"Température",
          'font': seasonal_title_font,
          },
        **seasonal_layout_params
      )
    fig.add_annotation(
         text= f"Mis à jour le : {df.index[-1].strftime('%d-%m-%Y')}",
         **seasonal_subtitle_params
    )
    fig.add_annotation(
        text="Source : Météo France",
        **seasonal_footer_params
    )
    
    return fig


def seasonal_precipitation(watershed, event, precipitation_path):
    
    # Read data
    if watershed is not None:
        df = pd.read_csv(os.path.join(precipitation_path, watershed+'.csv'), delimiter=',')
        df['t'] = pd.to_datetime(df['t'])
        df = df.set_index('t')
        df['year'] = pd.DatetimeIndex(df.index).year
        df['daily'] = df.index.strftime('%m-%d')
    
    # Créer une nouvelle colonne pour les dates formatées en "%d %B"
    df['formatted_date'] = pd.to_datetime(df.index, format='%m-%d').strftime('%-d %B')
    
    # Cumulative rainfall
    #df.reset_index(inplace=True)
    df = df[df['year'] != 1958]
    df['cumulative_daily_rainfall'] = 0.0

    for year in df['year'].unique():
        
        year_data = df[df['year'] == year]
        cumulative_rainfall = 0.0
        
        for index, row in year_data.iterrows():
            cumulative_rainfall += row['Q']
            df.at[index, 'cumulative_daily_rainfall'] = cumulative_rainfall
    
    # Sélection d'une année
    df_events = df[df['year'].isin(event)]
    
    # Statistiques à l'échelle d'une année civile
    q10 = df.groupby('daily')['cumulative_daily_rainfall'].quantile(0.1)
    q50 = df.groupby('daily')['cumulative_daily_rainfall'].median()
    q90 = df.groupby('daily')['cumulative_daily_rainfall'].quantile(0.9)
    
    # Plots
    fig = go.Figure()
    
    # Median values
    fig.add_trace(go.Scatter(
        x = q10.index,
        y = q50,
        name = f"moyenne [{df['year'][0]} - {df['year'][-1]}]",
        line = seasonal_median_line,
        ))
    
    # Interannual variability values
    fig.add_trace(
        go.Scatter(
            x = q10.index.tolist() + q10.index[::-1].tolist(),
            y = q10.tolist() + q90[::-1].tolist(),
            name = f"variabilité [{df['year'][0]} - {df['year'][-1]}]",
            **seasonal_variability,
        ))
    
    # Add selected years    
    for i, year in enumerate(event):
        df_event = df_events[df_events['year'] == year]
        color_hex = mcolors.to_hex(palette[i])
        fig.add_trace(
            go.Scatter(x=df_event['daily'], y=df_event['cumulative_daily_rainfall'], mode="lines", name=str(year),
                       line=dict(color=color_hex, width=1.5))  # Couleur spécifiée pour chaque année
        )
    
    fig.update_xaxes(**seasonal_x_axes)
    fig.update_yaxes(title=dict(text="Cumul des précipitations [mm]", font=seasonal_y_axes_font),
                     **seasonal_y_axes)
    fig.update_layout(
        title={
          'text': f"Précipitations",
          'font': seasonal_title_font,
          },
        **seasonal_layout_params
      )
    fig.add_annotation(
         text= f"Mis à jour le : {df.index[-1].strftime('%d-%m-%Y')}",
         **seasonal_subtitle_params
    )
    fig.add_annotation(
        text="Source : Météo France",
        **seasonal_footer_params
    )
    
    return fig

def seasonal_piezometric(watershed, event, piezo_path, piezo_name):
    
    # Read data
    if watershed is not None:
        df = pd.read_csv(os.path.join(piezo_path, piezo_name+'.csv'), delimiter=',')
        df['t'] = pd.to_datetime(df['t'])
        df = df.set_index('t')
        df['year'] = pd.DatetimeIndex(df.index).year
        df['daily'] = df.index.strftime('%m-%d')
    
    # Sélection d'une année
    df_events = df[df['year'].isin(event)]
    
    # Statistiques à l'échelle d'une année civile
    q10 = df.groupby('daily')['d'].quantile(0.1)
    q50 = df.groupby('daily')['d'].median()
    q90 = df.groupby('daily')['d'].quantile(0.9)
    
    # Plots
    fig = go.Figure()
    
    # Median values
    fig.add_trace(go.Scatter(
        x = q10.index,
        y = q50,
        name = f"moyenne [{df['year'][0]} - {df['year'][-1]}]",
        line = seasonal_median_line,
        ))
    
    # Interannual variability values
    fig.add_trace(
        go.Scatter(
            x = q10.index.tolist() + q10.index[::-1].tolist(),
            y = q10.tolist() + q90[::-1].tolist(),
            name = f"variabilité [{df['year'][0]} - {df['year'][-1]}]",
            **seasonal_variability,
        ))
    
    # Add selected years    
    for i, year in enumerate(event):
        df_event = df_events[df_events['year'] == year]
        color_hex = mcolors.to_hex(palette[i])
        fig.add_trace(
            go.Scatter(x=df_event['daily'], y=df_event['d'], mode="lines", name=str(year),
                       line=dict(color=color_hex, width=1.5))  # Couleur spécifiée pour chaque année
        )
    
    fig.update_xaxes(**seasonal_x_axes)
    fig.update_yaxes(title=dict(text="Profondeur [m]", font=seasonal_y_axes_font),
                     **seasonal_y_axes)
    fig.update_layout(
        title={
          'text': f"Profondeur de la nappe [{piezo_name}]",
          'font': seasonal_title_font,
          },
        yaxis = dict(autorange="reversed"),
        **seasonal_layout_params
      )
    fig.add_annotation(
         text= f"Mis à jour le : {df.index[-1].strftime('%d-%m-%Y')}",
         **seasonal_subtitle_params
    )
    fig.add_annotation(
        text="Source : ADES",
        **seasonal_footer_params
    )
    
    return fig


def nselog_map(watershed, cydre_app):
    dff = cydre_app.watersheds
    data = dff[watershed]['hydraulicprop']['exploration_results']
    
    y = data['f'] * 30
    x = data['k'] / 3600
    z = data['NSElog']
    
    x=np.unique(x)
    y=np.unique(y)
    X,Y = np.meshgrid(x,y)
    Z=z.reshape(len(y),len(x))
    
    # Créez la figure Plotly
    fig = go.Figure()

    # Ajoutez le contour
    #fig.add_trace(go.Contour(x=X, y=Y, z=Z, contours=dict(levels=[0.6, 0.7], colors=['red', 'orange'])))

    # Ajoutez la pcolormesh
    fig.add_trace(go.Heatmap(x=x, y=y, z=Z, colorscale='jet', zmin=0, zmax=1,
                             colorbar=dict(title=dict(text='<i>NSElog</i> [-]',
                                                      side='right',))))

    # Mise en forme de la figure
    fig.update_yaxes(title_text='<i>φ d</i> [m]', title_font=dict(size=15))
    fig.update_xaxes(title_text='<i>K</i> [m/s]', 
                     title_font=dict(size=15),
                     range = [-7, -3],
                     type='log',
                     showexponent="all",
                     exponentformat="power",
                     showticklabels=True,
                     tickfont=dict(size=10),
                     showline=True)
    fig.update_layout(yaxis=dict(range=[0.03, 15]))
    
    #pyo.plot(fig, filename='my_plot.html', auto_open=True)
    # Convertissez la figure Plotly en JSON sérialisable
    #fig, ax = plt.subplots()
    #CS = ax.contour(X, Y, Z, levels = [0.6, 0.7], colors = ['r','orange'])
    #ax.clabel(CS, inline=True, fontsize=10)
    
    #plt.pcolormesh(X,Y,Z, cmap = 'jet', vmin=0, vmax=1, shading='gouraud')
    #cbar = plt.colorbar()
    #cbar.set_label('NSElog [-]', rotation=270, fontsize=15, labelpad=16)
    #plt.xscale('log')
    #plt.ylabel(r'$\phi d$ [m]', fontsize=15)
    #plt.xlabel(r'$K$ [m/s]', fontsize=15)
    #plt.ylim(0.03,15)
    
    return fig


def typology_map(similar_watersheds, gdf_stations):
    
    gdf_subset = gdf_stations[gdf_stations["ID"].isin(similar_watersheds)]
    
    # Plot the regional map
    fig = px.scatter_mapbox(gdf_subset, lon=gdf_subset.geometry.x, lat=gdf_subset.geometry.y,
                            hover_name = gdf_subset["station_name"])
    
    # Update the layout
    fig.update_layout(mapbox_style="open-street-map",
                      mapbox_center={"lat": 48.2141667, "lon": -2.9424167},
                      mapbox_zoom=6.8,
                      paper_bgcolor="rgba(0,0,0,0)",
                      margin={"l": 0, "r": 0, "t": 0, "b": 0})
        
    return fig


def plot_streamflow_projections(cydre_app, log=True, module=False, baseflow=False, options='viz_matplotlib'):
    
    # Watershed folder for storing outputs as plots
    if log:
        filename = os.path.join(cydre_app.watershed_path, f"log_{str(cydre_app.simulation_date.date())}.tiff")
    else:
        filename = os.path.join(cydre_app.watershed_path, f"lin_{str(cydre_app.simulation_date.date())}.tiff")

    # Extract observation and projection timeseries data
    reference_df, projection_df, projection_series = cydre_app._get_streamflow()
    cydre_app.station_forecast.index = projection_df.index
    projection_df['Q50_station'] = cydre_app.station_forecast['Q50']
    projection_df['Q50_station'] *= (cydre_app.watershed_area * 1e6)
    projection_df['Q10_station'] = cydre_app.station_forecast['Q10']
    projection_df['Q10_station'] *= (cydre_app.watershed_area * 1e6)
    projection_df['Q90_station'] = cydre_app.station_forecast['Q90']
    projection_df['Q90_station'] *= (cydre_app.watershed_area * 1e6)
    
    # Calculate the module (1/10 x mean streamflow)
    if module:
        cydre_app.mod, cydre_app.mod10 = cydre_app._module(reference_df)
    
    # Calculate baseflow
    if baseflow:
        cydre_app.Q_baseflow = cydre_app.baseflow()
        reference_df['baseflow'] = cydre_app.Q_baseflow * cydre_app.watershed_area * 1e6
    
    # Operational indicator
    projection_df['intersection'] = projection_df['Q50'] <= cydre_app.mod10
    
    n_events = len(projection_series)
    n_events_alert = 0
    
    for events in range(len(projection_series)):
        projection_series[events]['intersection'] = projection_series[events]['Q_streamflow'] <= cydre_app.mod10
        projection_series[events]['alert'] = projection_series[events]['intersection'] & projection_series[events]['intersection'].shift(-1)
        if projection_series[events]['alert'].any():
            n_events_alert += 1
        else:
            n_events_alert += 0
    
    cydre_app.prop_alert_all_series = n_events_alert / n_events
        
    
    projection_df['alert'] = projection_df['intersection'] & projection_df['intersection'].shift(-1) # Il faut 2 jours au minimum sous le seuil pour qu'il y ait une alerte
    cydre_app.check_occurence = any(projection_df['alert']) == True
    if cydre_app.check_occurence:
        first_occurence = projection_df[projection_df['alert']].iloc[0]
        date_first_occurence = first_occurence.name
        cydre_app.ndays_before_alert = (date_first_occurence - projection_df.index[0]).days
        cydre_app.ndays_below_alert = sum(projection_df['intersection'])
        cydre_app.prop_below_alert = cydre_app.ndays_below_alert / projection_df['alert'].count()
    else:
        cydre_app.ndays_before_alert = 0
        cydre_app.ndays_below_alert = 0
        cydre_app.prop_below_alert = 0
        
    alert_df = projection_df[projection_df['alert']]
    q_values = alert_df['Q50'] * 86400
    cydre_app.volume_manquant = ((cydre_app.mod10*86400) - q_values).sum()
        
    # Merge observation and projection timeseries data
    merged_df = pd.merge(reference_df, projection_df, left_on=reference_df.index,
                         right_on=projection_df.index, how='right')
    merged_df = merged_df.set_index(merged_df['key_0'])

    if options == 'viz_matplotlib':
           
        # Plot initialization
        plt.style.use('seaborn-dark-palette')
        plt.rcParams.update({'font.family':'Arial'})
        mpl.rcParams['figure.figsize'] = 7, 4

        fig, ax = plt.subplots()
        
        # Add the uncertainty area of streamflow projetions (between Q10 and Q90)
        ax.fill_between(merged_df.index, merged_df['Q10'], merged_df['Q90'], color='#407fbd',
                        alpha=0.10, edgecolor='#407fbd', linewidth=0, label="zone d'incertitude [projection]")
        ax.plot(merged_df.index, merged_df['Q10'], color='#407fbd', linewidth=0.3)        
        ax.plot(merged_df.index, merged_df['Q90'], color='#407fbd', linewidth=0.3)
        
        # Add the individual series used for the projections trends
        for i, line in enumerate(projection_series):
            ax.plot(line.index, line['Q_streamflow'], color='grey', linewidth=0.10, linestyle='--')
            
        # Add the Median projection
        ax.plot(merged_df.index, merged_df['Q50'], color='blue', linewidth=1.5, linestyle='dotted',
            label='projection médiane')
        
        # Add the uncertainty area of station projetions (between Q10 and Q90)
        #ax.fill_between(merged_df.index, merged_df['Q10_station'], merged_df['Q90_station'], color='purple',
        #                alpha=0.10, edgecolor='purple', linewidth=0, label="zone d'incertitude [station]")
        #ax.plot(merged_df.index, merged_df['Q10_station'], color='purple', linewidth=0.3)        
        #ax.plot(merged_df.index, merged_df['Q90_station'], color='purple', linewidth=0.3)
        
        # Add the staiton forecast
        #ax.plot(merged_df.index, merged_df['Q50_station'], color='purple', linewidth=1.5, linestyle='dotted',
         #       label='stats sur la station')
        
        # Add the real data measured at the hydrological station
        ax.plot(reference_df.index, reference_df['Q'], color='k', linewidth=1,
            label="observation")
        
        # Add a vertical line representing the simualtion date
        ax.axvline(x=cydre_app.simulation_date, color='k', linestyle='--', linewidth=0.8)
        
        # Add module if selected by the user
        if module:
            ax.axhline(y=cydre_app.mod10, color='r', linestyle='--', linewidth=0.6, label='1/10 du module')
        
        # Add baseflow if selected by the user
        if baseflow:
            ax.plot(merged_df.index, merged_df['baseflow'], color='green', linewidth=1, linestyle='--', label='baseflow')
            #ax.plot(merged_df.index, merged_df['baseflow2'], color='purple', linewidth=1, linestyle='--', label='baseflow2')
        
        #ax2 = ax.twinx()
        #ax2.plot(cydre_app.precipitation.index, cydre_app.precipitation['Q'], color='red', linewidth=0.8, label='Précipitations journalières')
        #ax2.invert_yaxis()

        
        # Set axis parameters
        ax.tick_params(axis="both", direction = "inout")
        ax.tick_params(axis='x', rotation=45)
        if log:
            ax.set_yscale('log')
        ax.set_xlim(cydre_app.similarity_period[0], cydre_app.projection_period[-1])
        ax.set_ylim(bottom=0.001)
        ax.set_xlabel("Date", fontsize=12)
        ax.set_ylabel("Débit (m3/s)", fontsize=12)
        ax.legend(ncol=4, fontsize=8)
        ax.set_title(f"{cydre_app.watershed_name}" + f" - {len(cydre_app.scenarios)} événements ", fontsize=14)
        
        #ax2.set_ylabel('Pluies journalières (mm)', fontsize=12)
        #ax2.tick_params(axis='y', labelcolor='red')
        #ax2.set_xlim(cydre_app.similarity_period[0], cydre_app.projection_period[-1])
        #ax2.set_ylim(0, 100)

        
        plt.savefig(filename, dpi=500, format="tiff", pil_kwargs={"compression": "tiff_lzw"}, bbox_inches='tight', pad_inches=0.1)
        plt.show()

        return fig
    
    elif options == 'viz_plotly':
        
        # Watershed folder for storing outputs as plots
        if log:
            filename = os.path.join(cydre_app.watershed_path, f"log_{str(cydre_app.simulation_date.date())}.html")
        else:
            filename = os.path.join(cydre_app.watershed_path, f"lin_{str(cydre_app.simulation_date.date())}.html")
        
        # Projection events
        scenarios, n_scenarios = cydre_app._get_projection_origin(cydre_app.scenarios_chronicles)
        
        # Plot initialization
        plt.style.use('seaborn-dark-palette')
        plt.rcParams.update({'font.family':'Arial'})
        #mpl.rcParams['figure.figsize'] = 7, 4

        fig = go.Figure()

        # Add the uncertainty area of streamflow projections (between Q10 and Q90)
        fig.add_trace(go.Scatter(x=merged_df.index, y=merged_df['Q90'], fill=None, mode='lines', 
                                line=dict(color='#407fbd', width=1), fillcolor='rgba(64, 127, 189, 0.3)', showlegend=False,
                                hoverinfo='skip'))
        fig.add_trace(go.Scatter(x=merged_df.index, y=merged_df['Q10'], fill='tonexty', mode='lines', 
                                line=dict(color='#407fbd', width=1), fillcolor='rgba(64, 127, 189, 0.3)', name="zone d'incertitude",
                                hoverinfo='skip'))

        # Add the individual series used for the projections trends
        for i, line in enumerate(projection_series):
            fig.add_trace(go.Scatter(x=line.index, y=line['Q_streamflow'], mode='lines', 
                                    line=dict(color='grey', width=0.2, dash='dash'),
                                    hoverinfo='skip', showlegend=False))

        # Add the Median projection
        fig.add_trace(go.Scatter(x=merged_df.index, y=merged_df['Q50'], mode='lines', 
                                line=dict(color='blue', width=1.5, dash='dot'), name='projection médiane'))

        # Add the real data measured at the hydrological station
        fig.add_trace(go.Scatter(x=reference_df.index, y=reference_df['Q'], mode='lines', 
                                line=dict(color='black', width=1.5), name="observation"))

        # Add a vertical line representing the simulation date
        max_value = np.nanmax([merged_df['Q'].max(), projection_df['Q90'].max(), reference_df.loc[cydre_app.similarity_period]['Q'].max()])
        fig.add_shape(type="line", x0=cydre_app.simulation_date, y0=0, x1=cydre_app.simulation_date, y1=1, yref='paper', 
                    line=dict(color="rgba(0, 0, 0, 1)", width=1, dash="dot"))
        
        fig.add_annotation(
            x=cydre_app.simulation_date,  # Position x de l'annotation
            y=1.1,  # Position y de l'annotation (au-dessus de la ligne)
            text="Début de la simulation",  # Texte de l'annotation
            showarrow=True,  # Masquer la flèche
            font=dict(
                family="Arial",
                size=12,
                color="black"
            ),
            align="center"  # Alignement du texte
        )
        
        fig.add_layout_image(
            dict(
                source="https://upload.wikimedia.org/wikipedia/fr/e/eb/Logo_Centre_national_de_la_recherche_scientifique_%282008-2023%29.svg", # Chemin ou URL de l'image
                xref="paper", yref="paper",
                x=1, y=1.05,
                sizex=0.2, sizey=0.2,
                xanchor="right", yanchor="bottom"
                )
         )

        # Add module if selected by the user
        if module:
            fig.add_trace(go.Scatter(
                x=[merged_df.index.min(), merged_df.index.max()],
                y=[cydre_app.mod10, cydre_app.mod10],
                mode='lines',
                line=dict(color="red", width=1),
                name='1/10 du module'
            ))

        # Add baseflow if selected by the user
        if baseflow:
            fig.add_trace(go.Scatter(x=merged_df.index, y=merged_df['baseflow'], mode='lines', 
                                    line=dict(color='green', width=1, dash='dash'), name='baseflow'))
            #fig.add_trace(go.Scatter(x=merged_df.index, y=merged_df['baseflow2'], mode='lines', 
            #                         line=dict(color='purple', width=1, dash='dash'), name='baseflow2'))

        # Set axis parameters
        fig.update_xaxes(range=[cydre_app.similarity_period[0], cydre_app.projection_period[-1]], 
             #tickvals=pd.date_range(start=cydre_app.similarity_period[0], end=cydre_app.projection_period[-1]),
             tickformat="%d-%m-%Y", title="Date", showgrid=False, type='date')
        fig.update_yaxes(range=[1e-3, None], showgrid=False)


        #fig.update_xaxes(tickvals=pd.date_range(start=cydre_app.similarity_period[0], end=cydre_app.projection_period[-1], freq='Y'),
        #                tickformat="%Y", title="Date")
        fig.update_yaxes(type='log' if log else None, title="Débit (m3/s)", rangemode='tozero')
        fig.update_layout(title=f"{cydre_app.watershed_name}" + f" - {len(cydre_app.scenarios)} événements ", legend=dict(x=0, y=1.1, orientation="h"),
                        margin=dict(l=40, r=40, t=80, b=40), plot_bgcolor='white')
        
        fig.update_layout(template="simple_white")  # Choisir un modèle de thème, par exemple "plotly_dark"
        fig.update_layout(font=dict(family="Arial"))  # Définir la police de caractères
        fig.update_layout(width=800, height=450)  # Définir la largeur et la hauteur de la figure
        fig.update_layout(hovermode='x unified')  # Limite les informations affichées au survol à l'axe x uniquement
        fig.update_layout(hovermode='closest')  # Affiche les informations pour la trace la plus proche du point de survol
    
        # Save and show plot
        fig.write_html(filename)
        fig.show()

        return fig