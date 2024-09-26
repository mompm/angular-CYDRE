// Array<string> instead of string because it caused some display bug
export interface ParametersGroup {
    name: Array<string>,
    Parameter?: Array<Parameter>,
    ParametersGroup?: Array<ParametersGroup>
}

export interface Parameter{
    name: Array<string>,
    description: Array<string>,
    possible_values: Array<string>,
    type: Array<string>,
    value: Array<string>,
    default_value: Array<string>
}

