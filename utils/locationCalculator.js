const { acos,sin,cos } = Math

const EARTH_RADIUS_KM = 6371
const RADIAN_DEGREE = Math.PI/180

function coordinatesToRadians(coordinates){
    return {
        lat: coordinates.lat * RADIAN_DEGREE,
        lon: coordinates.lon * RADIAN_DEGREE
    }
}

const locationCalculator = {
    /**
     * calculates the great circle distance between two points in kilometers
     * @param {number} c1.lat latitude starting point
     * @param {number} c1.lon longitude starting point
     * @param {number} c2.lat latitude destination point
     * @param {number} c2.lon longitude destination point
     * @returns {number} great circle distance in kilometers
     */
    greatCircleDistanceKilometer(c1,c2){
        const cr1 = coordinatesToRadians(c1)
        const cr2 = coordinatesToRadians(c2)

        return EARTH_RADIUS_KM * acos(
            sin(cr1.lat)
            *sin(cr2.lat)
            +
            cos(cr1.lat)
            *cos(cr2.lat)
            *cos(cr2.lon-cr1.lon)
        )
    }
}

module.exports = locationCalculator