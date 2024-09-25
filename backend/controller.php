<?php
header("Content-Type:application/json");
header('Access-Control-Allow-Origin: *');
header("Access-Control-Allow-Headers: X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Request-Method");

// Incluir el archivo de configuración de base de datos
include 'db_config.php';

// Función para ejecutar una consulta en SQL Server
function fetch_data($query, $mysqli) {
    $stmt = mssql_query($query, $mysqli);

    if (!$stmt) {
        echo json_encode(["success" => 0, "error" => "Error al ejecutar la consulta en SQL Server: " . mssql_get_last_message()]);
        exit;
    }

    $data = [];
    while ($row = mssql_fetch_assoc($stmt)) {
        $data[] = $row;
    }

    mssql_free_result($stmt);
    return $data;
}

// Conectar a SQL Server usando mssql_connect
$mysqli = mssql_connect($sqlsrv_server, $sqlsrv_username, $sqlsrv_password);

if (!$mysqli) {
    echo json_encode(["success" => 0, "error" => "Conexión fallida a SQL Server"]);
    exit;
}

// Seleccionar la base de datos SQL Server
if (!mssql_select_db($sqlsrv_database, $mysqli)) {
    echo json_encode(["success" => 0, "error" => "No se pudo seleccionar la base de datos: $sqlsrv_database"]);
    exit;
}

// Establecer las opciones ANSI_NULLS y ANSI_WARNINGS
mssql_query("SET ANSI_NULLS ON", $mysqli);
mssql_query("SET ANSI_WARNINGS ON", $mysqli);

// Obtener datos enviados por el frontend
$data = json_decode(file_get_contents('php://input'), true);
$tipo = isset($data['tipo']) ? $data['tipo'] : null;

// Obtener los locales activos (tipo: 'obtener_locales')
if ($tipo == 'obtener_locales') {
    $query = "SELECT sigla, ipserver, rutadb, userdb, passdb FROM ADM_CEFS WHERE activo = 1";
    $locales = fetch_data($query, $mysqli);

    echo json_encode(["success" => 1, "locales" => $locales]);

} elseif ($tipo == 'consultar_ventas') {
    // Validar los parámetros
    if (!isset($data['cef']) || !isset($data['feci']) || !isset($data['fecf'])) {
        echo json_encode(["success" => 0, "error" => "Parámetros faltantes: cef, feci o fecf"]);
        exit;
    }

    // Asignar los valores enviados por el frontend
    $cef = $data['cef'];
    $feci = $data['feci'];
    $fecf = $data['fecf'];

    // Comprobar si se seleccionó "TODOS"
    if ($cef === 'TODOS') {
        $cef = '%%';  // '%%' para SQL significa que coincida con cualquier valor
    }

    // Conexión a la segunda base de datos para la consulta de ventas
    $mysqli2 = mssql_connect($sqlsrv_server_2, $sqlsrv_username_2, $sqlsrv_password_2);
    if (!$mysqli2) {
        echo json_encode(["success" => 0, "error" => "Conexión fallida a SQL Server en la segunda base de datos"]);
        exit;
    }

    if (!mssql_select_db($sqlsrv_database_2, $mysqli2)) {
        echo json_encode(["success" => 0, "error" => "No se pudo seleccionar la base de datos: $sqlsrv_database_2"]);
        exit;
    }

    // Establecer las opciones ANSI_NULLS y ANSI_WARNINGS en la segunda conexión
    mssql_query("SET ANSI_NULLS ON", $mysqli2);
    mssql_query("SET ANSI_WARNINGS ON", $mysqli2);

    // Ejecutar la consulta de ventas con los parámetros
    $query = "
        DECLARE @feci date;
        DECLARE @fecf date;
        DECLARE @cef nvarchar(10);

        SET @feci = '$feci';
        SET @fecf = '$fecf';
        SET @cef = '$cef';

        IF @cef = ''
            SET @cef = '%%';

        DECLARE @tqbvtas table(cef nvarchar(10),fec date,imp_vtas decimal(12,2), imp_tic_sub decimal(12,2), imp_tick_fal decimal(12,2),imp_tic_Coint decimal(12,2));
        DECLARE @tabfac table(cef nvarchar(10),fec_vta date, fec_fac date,uuid nvarchar(100),esta nvarchar(100), imp decimal(12,2));
        DECLARE @tabres table(cef nvarchar(10),fec date,imp_vtas decimal(12,2),imp_tic_coin decimal(12,2),dif_vtas_ticoin decimal(12,2),imp_tic_sub decimal(12,2),imp_tick_falt decimal(12,2), sum_Tic_sun_fal decimal(12,2),dif_tic_sub_fal_coin decimal(12,2));

        INSERT INTO @tqbvtas
        SELECT [cef], [fecha], [venta]-[ventaWeb] vtas_real, 0, 0, 0
        FROM [dbo].[rtv_ventas]
        WHERE fecha BETWEEN @feci AND @fecf;

        INSERT INTO @tqbvtas
        SELECT [SERIE], [Fecha_vta], 0, SUM(CAST([TOTAL] AS decimal(12,2))) total, 0, 0
        FROM [192.168.0.174].[COINTECH_DB].[dbo].[Tickets_cs_facturacion]
        WHERE fecha_vta BETWEEN @feci AND @fecf
        GROUP BY [SERIE], [Fecha_vta]
        ORDER BY [SERIE], [Fecha_vta];

        INSERT INTO @tqbvtas
        SELECT [CLOCAL], [FECHA], 0, 0, SUM([IMPORTE]), 0
        FROM [192.168.0.174].[COINTECH_DB].[dbo].[FA_POS_TICKETS_FAL]
        WHERE fecha BETWEEN @feci AND @fecf
        GROUP BY [CLOCAL], [FECHA]
        ORDER BY [CLOCAL], [FECHA];

        INSERT INTO @tqbvtas
        SELECT CAST([CEF] AS nvarchar(10)), CAST([FECHA] AS date), 0, 0, 0, SUM(CAST([IMPORTE] AS decimal(12,2)))
        FROM [192.168.0.174].[COINTECH_DB].[dbo].[tickets_db_cointech_cef]
        WHERE fecha BETWEEN @feci AND @fecf
        GROUP BY [CEF], [FECHA]
        ORDER BY [CEF], [FECHA];

        INSERT INTO @tabfac
        SELECT [SERIE], [Fecha_vta], [Fecha_factura], [uuid_Global_Si_ existe], [ESTATUS], SUM(CAST([TOTAL] AS decimal(12,2))) total
        FROM [192.168.0.174].[COINTECH_DB].[dbo].[Tickets_cs_facturacion]
        WHERE [Fecha_vta] BETWEEN @feci AND @fecf
        GROUP BY [SERIE], [Fecha_vta], [Fecha_factura], [uuid_Global_Si_ existe], [ESTATUS]
        ORDER BY [SERIE], [Fecha_vta], [Fecha_factura], [uuid_Global_Si_ existe], [ESTATUS];

        INSERT INTO @tabres
        SELECT vt.cef, vt.fec, SUM(vt.imp_vtas) imp_vtas, SUM(vt.imp_tic_Coint) tickets_cointec, SUM(vt.imp_vtas) - SUM(vt.imp_tic_Coint) 'Diferencia vtas vs Tic cointe', 
        SUM(vt.imp_tic_sub) ticket_sub, SUM(vt.imp_tick_fal) tickets_Falt, SUM(vt.imp_tic_sub) + SUM(vt.imp_tick_fal) 'Suma tickets sub +falt', 
        (SUM(vt.imp_tic_sub) + SUM(vt.imp_tick_fal)) - SUM(vt.imp_tic_Coint) difrencia
        FROM @tqbvtas vt
        WHERE vt.fec BETWEEN @feci AND @fecf
        GROUP BY vt.cef, vt.fec
        ORDER BY vt.cef, vt.fec;

        SELECT re.cef Cef, re.fec 'Fecha_Vta', 
        CASE WHEN re.fec <> fa.fec_fac THEN 0 ELSE re.imp_vtas END 'Imp_Vtas', 
        CASE WHEN re.fec <> fa.fec_fac THEN 0 ELSE re.imp_tic_coin END 'Imp_Ticket_cointech', 
        CASE WHEN re.fec <> fa.fec_fac THEN 0 ELSE re.dif_vtas_ticoin END 'Diferencia_vtas_vs_tic_coint', 
        CASE WHEN re.fec <> fa.fec_fac THEN 0 ELSE re.imp_tic_sub END 'imp_tick_sub',
        CASE WHEN re.fec <> fa.fec_fac THEN 0 ELSE re.imp_tick_falt END 'Imp_tickets_faltan', 
        CASE WHEN re.fec <> fa.fec_fac THEN 0 ELSE re.sum_Tic_sun_fal END 'Suma_ticketa_falt_cointech',
        CASE WHEN re.fec <> fa.fec_fac THEN 0 ELSE re.dif_tic_sub_fal_coin END 'Difere_tic_sub_fal_menos_coint',
        fa.uuid 'Factura', fa.imp  'Importe_Factura_global', fa.fec_fac 'fecha_real_factura'
        FROM @tabres re
        LEFT JOIN @tabfac fa ON fa.cef = re.cef AND fa.fec_vta = re.fec
        WHERE re.fec BETWEEN @feci AND @fecf AND re.cef LIKE @cef;
    ";

    $result = fetch_data($query, $mysqli2);
    echo json_encode(["success" => 1, "data" => $result]);

    // Cerrar la conexión a SQL Server
    mssql_close($mysqli2);
}

// Cerrar la conexión a SQL Server
mssql_close($mysqli);
