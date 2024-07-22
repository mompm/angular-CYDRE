# -*- coding: utf-8 -*-

"""
Toolbox used for repetitive functions.
"""

import os
import pickle


def create_folder(path):
    if not os.path.exists(path):
        os.makedirs(path)
        
def save_object(obj, out_path, name):
    with open(os.path.join(out_path,name), 'wb+') as f:
        pickle.dump(obj, f, pickle.HIGHEST_PROTOCOL)

def load_object(out_path, name):
    with open(os.path.join(out_path,name), 'rb') as f:
        return pickle.load(f)