#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../src/config/db.js';
import Usuario from '../src/models/Usuario.js';

const print = console.log; // shorthand

const help = () => {
    print(`\nHerramientas de usuarios\n\nUso:\n  node scripts/user-tools.js create-ceo --email <email> --password <password>\n  node scripts/user-tools.js create-user --email <email> --password <password> --rol <ceo|camionero|administracion> --nombre <Nombre>\n  node scripts/user-tools.js create-default-ceo\n  node scripts/user-tools.js reset-password --email <email> --password <password>\n  node scripts/user-tools.js purge-admins\n  node scripts/user-tools.js list-users\n\nNotas:\n- Requiere base de datos configurada via .env\n- Las contraseñas se hashean automáticamente (hooks Sequelize)\n`);
    if (cmd === 'create-user') {
        const email = String(args.email || '').trim();
        const password = String(args.password || '').trim();
        const rol = String(args.rol || '').trim().toLowerCase();
        const nombre = String(args.nombre || 'Usuario').trim();
        const allowed = ['ceo', 'camionero', 'administracion'];
        if (!email || !password || !rol) {
            print('Faltan argumentos: --email --password --rol [--nombre]');
            help();
            process.exit(1);
        }
        if (!allowed.includes(rol)) {
            print(`Rol inválido: ${rol}. Debe ser uno de ${allowed.join(', ')}`);
            process.exit(1);
        }
        let user = await Usuario.findOne({ where: { email } });
        if (!user) {
            user = await Usuario.create({ nombre, email, password, rol });
            print(`Usuario creado: ${email} (${rol})`);
        } else {
            user.nombre = nombre;
            user.rol = rol;
            user.password = password; // hook hash
            await user.save();
            print(`Usuario existente actualizado: ${email} (${rol})`);
        }
        process.exit(0);
    }
};

const parseArgs = (argv) => {
    const args = { _: [] };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith('--')) {
            const key = a.slice(2);
            const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
            args[key] = val;
        } else {
            args._.push(a);
        }
    }
    return args;
};

async function main() {
    const args = parseArgs(process.argv);
    const cmd = args._[0];

    if (!cmd || ['-h', '--help', 'help'].includes(cmd)) {
        help();
        process.exit(0);
    }

    await connectDB();

    try {
        if (cmd === 'list-users') {
            const users = await Usuario.findAll({ attributes: ['id', 'nombre', 'email', 'rol'] });
            if (!users.length) {
                print('No hay usuarios.');
            } else {
                users.forEach(u => print(`${u.id}\t${u.email}\t${u.rol}\t${u.nombre}`));
            }
            process.exit(0);
        }

        if (cmd === 'create-ceo') {
            const email = String(args.email || '').trim();
            const password = String(args.password || '').trim();
            if (!email || !password) {
                print('Falta --email o --password');
                help();
                process.exit(1);
            }
            let user = await Usuario.findOne({ where: { email } });
            if (!user) {
                user = await Usuario.create({ nombre: 'CEO', email, password, rol: 'ceo' });
                print(`Usuario CEO creado: ${email}`);
            } else {
                user.rol = 'ceo';
                user.password = password; // hook hará hash
                await user.save();
                print(`Usuario existente actualizado a CEO y password reseteado: ${email}`);
            }
            process.exit(0);
        }

        if (cmd === 'reset-password') {
            const email = String(args.email || '').trim();
            const password = String(args.password || '').trim();
            if (!email || !password) {
                print('Falta --email o --password');
                help();
                process.exit(1);
            }
            const user = await Usuario.findOne({ where: { email } });
            if (!user) {
                print(`Usuario no encontrado: ${email}`);
                process.exit(1);
            }
            user.password = password; // hook hará hash
            await user.save();
            print(`Password reseteado para: ${email}`);
            process.exit(0);
        }

        if (cmd === 'purge-admins') {
            const count = await Usuario.destroy({ where: { rol: 'admin' } });
            print(`Usuarios con rol 'admin' eliminados: ${count}`);
            process.exit(0);
        }

        if (cmd === 'create-default-ceo') {
            const email = process.env.CEO_EMAIL || 'ceo@example.com';
            const password = process.env.CEO_PASSWORD || 'ceo123';
            let user = await Usuario.findOne({ where: { email } });
            if (!user) {
                user = await Usuario.create({ nombre: 'CEO', email, password, rol: 'ceo' });
                print(`Usuario CEO creado: ${email}`);
            } else {
                print(`Ya existe un usuario con email ${email}`);
            }
            process.exit(0);
        }

        print(`Comando desconocido: ${cmd}`);
        help();
        process.exit(1);
    } catch (err) {
        console.error('Error:', err?.message || err);
        process.exit(1);
    }
}

main();
