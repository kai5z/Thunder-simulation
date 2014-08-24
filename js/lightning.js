/**
 * Copyright Kai Saksela 2014
 *
 * This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
var LightningGenerator =
{

    //Distance between two points
    dist: function(p1,p2)
    {
        return Math.sqrt(Math.pow(p2.x-p1.x,2)+Math.pow(p2.y-p1.y,2)+Math.pow(p2.z-p1.z,2))
    },

    //Normal distribution
    normal: function(mean, stdev)
    {
        function rnd_snd() {
            return (Math.random() * 2 - 1) + (Math.random() * 2 - 1) + (Math.random() * 2 - 1);
        }

        return rnd_snd() * stdev + mean;
    },

    //normalize vector to unit vector
    unit: function(v) {
        v_len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        v.x = v.x / v_len;
        v.y = v.y / v_len;
        v.z = v.z / v_len;

        return v;
    },

    //Cross product of two vectors
    cross: function(u, v) {
        return {
            x: u.y * v.z - u.z * v.y,
            y: u.z * v.x - u.x * v.z,
            z: u.x * v.y - u.y * v.x
        };
    },

    generate_lightning_point: function(p, v1, v2, v3, z_delta) {
        //Variables loosely based on Rakov et al. ("Lightning, physics and effects") p. 378
        var segment = {
            length: this.normal(40, 10) + 5,
            theta: this.normal(30, 5) / 180.0 * Math.PI, //stats say average 16
            phi: Math.random() * 2.0 * Math.PI
        };

        //Constraints, 1
        if (segment.length < 3.5) segment.length = 3.5;
        if (segment.length > 70.0) segment.length = 70.0;
        if (segment.theta < 0) segment.theta = -segment.theta;
        if (segment.theta > Math.PI) segment.theta = Math.PI;

        //New point based on segment
        var new_p = {x: segment.length * Math.sin(segment.theta) * Math.cos(segment.phi),
            y: segment.length * Math.sin(segment.theta) * Math.sin(segment.phi),
            z: segment.length * Math.cos(segment.theta)};

        //Rotate and translate to its correct place (relative to prev)
        var temp_p = {x: 0, y: 0, z: 0};
        temp_p.x = p.x + new_p.x * v1.x + new_p.y * v2.x + new_p.z * v3.x;
        temp_p.y = p.y + new_p.x * v1.y + new_p.y * v2.y + new_p.z * v3.y;
        temp_p.z = p.z + z_delta + new_p.x * v1.z + new_p.y * v2.z + new_p.z * v3.z; //Add small trend upwards
        new_p = temp_p;

        //Constraints, 2
        if (new_p.z < 2.0) new_p.z = 2.0 + Math.random() * 2.0; //It can't go through the ground in our sim

        //Update vectors describing previous segment
        var v3 = {x: new_p.x - p.x,
            y: new_p.y - p.y,
            z: new_p.z - p.z};
        v3 = this.unit(v3);
        var v1, v2;
        if (v3.x < 0.95) {
            v2 = this.cross(v3, {x: 1.0, y: 0, z: 0});
        }
        else {
            v2 = this.cross(v3, {x: 0, y: 1.0, z: 0});
        }
        v2 = this.unit(v2);
        v1 = this.cross(v3, v2);
        v1 = this.unit(v1);

        return {p: new_p, v1: v1, v2: v2, v3: v3, length: segment.length};
    },

    generate_branch: function(pos, length, direction, branch_p) {
        var lightning_points = [[]];
        var p = {x: pos.x, y: pos.y, z: pos.z};
        lightning_points[0].push({x: p.x, y: p.y, z: p.z});

        //Random start dir
        var v3 = {x: Math.random(), y: Math.random(), z: direction};
        v3 = this.unit(v3);
        var v1, v2;
        if (v3.x < 0.95) {
            v2 = this.cross(v3, {x: 1.0, y: 0, z: 0});
        }
        else {
            v2 = this.cross(v3, {x: 0, y: 1.0, z: 0});
        }
        v2 = this.unit(v2);
        v1 = this.cross(v3, v2);
        v1 = this.unit(v1);

        var branch_length = 0;

        while (branch_length < length) {
            if (Math.random() < branch_p) {
                console.log("Adding " + lightning_points.length);
                lightning_points = lightning_points.concat(this.generate_branch(p, Math.random() * 0.5 * length, direction, branch_p));
                console.log("Now " + lightning_points.length);
                console.log(lightning_points);
            }

            var gen_data = this.generate_lightning_point(p, v1, v2, v3, direction);

            p = gen_data.p;
            v1 = gen_data.v1;
            v2 = gen_data.v2;
            v3 = gen_data.v3;
            branch_length += gen_data.length;

            lightning_points[0].push({x: p.x, y: p.y, z: p.z}); //Remember, this needs postprocessing
        }

        return lightning_points;
    },

    generate_lightning: function(x_pos, y_pos, height, width, branch_p) {
        var lightning_points, p, v1, v2, v3, branches;
        var branches = [];
        var z_trend = 2.5, i = 0, ideal_z = 0;

        function reset_lightning() {
            //Array of points
            lightning_points = [];
            branches = [];
            i = 0;
            z_trend = 2.0;
            ideal_z = 0;

            //Current position
            p = {x: x_pos, y: y_pos, z: 0};
            lightning_points.push({x: p.x, y: p.y, z: p.z});

            //Previous segment coordinate system for defining new point
            v1 = {x: 1.0, y: 0, z: 0};
            v2 = {x: 0, y: 1.0, z: 0};
            v3 = {x: 0, y: 0, z: 1.0};
        }

        reset_lightning();

        var branch_direction = Math.random() * 3.0 - 1.5;
        var ideal_segments = height/40.0 * 0.95;
        while (p.z < height) {
            if (Math.random() < branch_p)
            {
                var branch = this.generate_branch(p, Math.random() * 0.5 * height, branch_direction, branch_p);
                branches = branches.concat(branch);
            }

            //Penalizing too much curvature downwards
            if(p.z < ideal_z)
            {
                z_trend += 0.2;
                if(z_trend > 3.0)
                {
                    ideal_segments++;
                }
            }
            else
            {
                z_trend -= 0.2;
            }

            var gen_data = this.generate_lightning_point(p, v1, v2, v3, z_trend);

            p = gen_data.p;
            v1 = gen_data.v1;
            v2 = gen_data.v2;
            v3 = gen_data.v3;

            lightning_points.push(p);

            //If the lightning is invalid, restart the process
            if (p.x < x_pos - width / 2 || p.x > x_pos + width / 2 ||
                p.y < y_pos - width / 2 || p.y > y_pos + width / 2) {
                reset_lightning();
            }
            i++;
            ideal_z = (height+0.0) / ideal_segments * i;
            console.log(ideal_z);
        }

        //Generate the "crown" inside the cloud
        //Earth's electrical environment (geophysics study committee), p. 33
        var top = [];
        for (var i = 0; i < 3 + Math.random() * 5; i++) {
            top = top.concat(this.generate_branch(p, Math.random() * 0.5 * height, 0.0, 0.0));
        }


        return {main: lightning_points, branches: branches, top: top};
    }

}

