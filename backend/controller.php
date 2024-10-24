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

        -- Validar si el CEF es 'TODOS'
        IF @cef = 'TODOS'
        BEGIN
            SET @cef = '%%';  -- Wildcard para todos los valores
        END

        DECLARE @tqbvtas table(cef nvarchar(10),fec date,imp_vtas decimal(12,2), imp_tic_sub decimal(12,2), imp_tick_fal decimal(12,2),imp_tic_Coint decimal(12,2));
        DECLARE @tabfac table(cef nvarchar(10),fec_vta date, fec_fac date,uuid nvarchar(100),esta nvarchar(100), imp decimal(12,2));
        DECLARE @tabres table(cef nvarchar(10),fec date,imp_vtas decimal(12,2),imp_tic_coin decimal(12,2),dif_vtas_ticoin decimal(12,2),imp_tic_sub decimal(12,2),imp_tick_falt decimal(12,2), sum_Tic_sun_fal decimal(12,2),dif_tic_sub_fal_coin decimal(12,2));

        INSERT INTO @tqbvtas
        SELECT CAST([cef] AS nvarchar(10)), [fecha], [venta]-[ventaWeb] vtas_real, 0, 0, 0
        FROM [dbo].[rtv_ventas]
        WHERE fecha BETWEEN @feci AND @fecf;

        INSERT INTO @tqbvtas
        SELECT CAST([SERIE] AS nvarchar(10)), [Fecha_vta], 0, SUM(CAST([TOTAL] AS decimal(12,2))) total, 0, 0
        FROM [192.168.0.174].[COINTECH_DB].[dbo].[Tickets_cs_facturacion]
        WHERE fecha_vta BETWEEN @feci AND @fecf
        GROUP BY [SERIE], [Fecha_vta]
        ORDER BY [SERIE], [Fecha_vta];

        INSERT INTO @tqbvtas
        SELECT CAST([CLOCAL] AS nvarchar(10)), [FECHA], 0, 0, SUM([IMPORTE]), 0
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
        SELECT CAST([SERIE] AS nvarchar(10)), [Fecha_vta], [Fecha_factura], [uuid_Global_Si_ existe], [ESTATUS], SUM(CAST([TOTAL] AS decimal(12,2))) total
        FROM [192.168.0.174].[COINTECH_DB].[dbo].[Tickets_cs_facturacion]
        WHERE [Fecha_vta] BETWEEN @feci AND @fecf
        GROUP BY [SERIE], [Fecha_vta], [Fecha_factura], [uuid_Global_Si_ existe], [ESTATUS]
        ORDER BY [SERIE], [Fecha_vta], [Fecha_factura], [uuid_Global_Si_ existe], [ESTATUS];
        
        INSERT INTO @tabres
        SELECT vt.cef
            ,vt.fec
            ,sum(vt.imp_vtas) imp_vtas
            ,sum(vt.imp_tic_Coint) tickets_cointec
            ,sum(vt.imp_vtas) - sum(vt.imp_tic_Coint) 'Diferencia vtas vs Tic cointe'
            ,sum(vt.imp_tic_sub) ticket_sub
            ,sum(vt.imp_tick_fal) tickets_Falt
            ,sum(vt.imp_tic_sub) + sum(vt.imp_tick_fal) 'Suma tickets sub +falt'
            ,sum(vt.imp_tic_Coint) - (sum(vt.imp_tic_sub) + sum(vt.imp_tick_fal))  difrencia 
        FROM @tqbvtas vt
        WHERE vt.fec BETWEEN @feci AND @fecf
        GROUP BY vt.cef, vt.fec
        ORDER BY vt.cef, vt.fec;

        SELECT re.cef Cef, 
        re.fec 'Fecha_Vta', 
        re.imp_vtas 'Imp_Vtas',
        re.imp_tic_coin 'Imp_Ticket_cointech',
        re.dif_vtas_ticoin 'Diferencia_vtas_vs_tic_coint',
        re.imp_tic_sub 'imp_tick_sub',
        re.imp_tick_falt 'Imp_tickets_faltan',
        re.sum_Tic_sun_fal 'Suma_ticketa_falt_cointech',
        re.dif_tic_sub_fal_coin 'Difere_tic_sub_fal_menos_coint',
        fa.uuid 'Factura',
        fa.imp  'Importe_Factura_global',
        fa.fec_fac 'fecha_real_factura'
        
        FROM @tabres re
        LEFT JOIN @tabfac fa ON fa.cef = re.cef AND fa.fec_vta = re.fec
        WHERE re.fec BETWEEN @feci AND @fecf 
        -- Aquí se usa 'LIKE' para admitir el wildcard '%%'
        AND (re.cef LIKE @cef);
    ";
    $result = fetch_data($query, $mysqli2);
    echo json_encode(["success" => 1, "data" => $result]);

    // Cerrar la conexión a SQL Server
    mssql_close($mysqli2);
}elseif ($tipo == 'consultar_ventas_otros_reportes') {
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

    // Cerrar cualquier conexión previa
    if (isset($mysqli)) {
        mssql_close($mysqli);  
    }

    // Conectar al servidor 192.168.0.174 para ejecutar la consulta
    $mysqli = mssql_connect($sqlsrv_server, $sqlsrv_username, $sqlsrv_password);
    if (!$mysqli) {
        echo json_encode(["success" => 0, "error" => "Conexión fallida a SQL Server en la base de datos principal"]);
        exit;
    }

    if (!mssql_select_db($sqlsrv_database, $mysqli)) {
        echo json_encode(["success" => 0, "error" => "No se pudo seleccionar la base de datos en el servidor principal"]);
        exit;
    }

    // Establecer las opciones ANSI_NULLS y ANSI_WARNINGS
    mssql_query("SET ANSI_NULLS ON", $mysqli);
    mssql_query("SET ANSI_WARNINGS ON", $mysqli);

    // Ejecutar la consulta desde 192.168.0.174 al servidor vinculado [192.168.0.59]
    $query = "
        DECLARE @tabvtas table(cef nvarchar(10), fec date, impvta decimal(12, 2));

        -- Sumar las ventas por CEF, fecha desde el servidor vinculado [192.168.0.59]
        INSERT INTO @tabvtas
        SELECT [SERIE], [Fecha_vta], SUM(CAST([TOTAL] AS decimal(12,2)))
        FROM [COINTECH_DB].[dbo].[Tickets_cs_facturacion]
        WHERE [Fecha_vta] BETWEEN '$feci' AND '$fecf'
        GROUP BY [SERIE], [Fecha_vta]
        ORDER BY [SERIE], [Fecha_vta];

        -- Selección de las ventas desde el servidor vinculado
        SELECT vt.[cef], vt.[fecha], 
            CAST((vt.[venta] - vt.[ventaWeb]) AS decimal(12, 2)) AS vtas_real, 
            CAST(tm.impvta AS decimal(12, 2)) AS imp_global, 
            CAST((vt.[venta] - vt.[ventaWeb]) - tm.impvta AS decimal(12, 2)) AS Diferencia
        FROM [192.168.0.59].[GrupoDiniz].[dbo].[rtv_ventas] vt
        LEFT JOIN @tabvtas tm 
            ON tm.cef = vt.cef COLLATE Modern_Spanish_CI_AS 
            AND tm.fec = vt.fecha
        WHERE vt.fecha BETWEEN '$feci' AND '$fecf' 
        AND vt.cef LIKE '$cef'
        ORDER BY vt.[cef], vt.[fecha];
    ";


    $result = fetch_data($query, $mysqli);
    echo json_encode(["success" => 1, "data" => $result]);

    // Cerrar la conexión a SQL Server después de la consulta
    mssql_close($mysqli);
}elseif ($tipo == 'reporte_venta_real') {
    // Validar los parámetros
    if (!isset($data['cef']) || !isset($data['fecha'])) {
        echo json_encode(["success" => 0, "error" => "Parámetros faltantes: cef o fecha"]);
        exit;
    }

    // Asignar los valores enviados por el frontend
    $cef = $data['cef'];
    $fecha = $data['fecha'];

    // Conexión a la base de datos principal
    if (!mssql_select_db($sqlsrv_database, $mysqli)) {
        echo json_encode(["success" => 0, "error" => "No se pudo seleccionar la base de datos"]);
        exit;
    }

    // Establecer las opciones ANSI_NULLS y ANSI_WARNINGS
    mssql_query("SET ANSI_NULLS ON", $mysqli);
    mssql_query("SET ANSI_WARNINGS ON", $mysqli);

    // Consulta SQL para obtener los datos de "Venta Real Cointech"
    $query = "
    SELECT
        [CEF] as cef,
        [FECHA] as fecha_vta,
        [ID_TRANSACCION] as id_transaccion,
        [HORA] as hora,
        [NUMERO_TERMINAL] as numero_terminal,
        CAST([NUMERO_COMPROBANTE] AS bigint) as numero_comprobante,
        CAST([IMPORTE] AS decimal(12, 2)) as importe_vta
    FROM
        [COINTECH_DB].[dbo].[tickets_db_cointech_cef]
    WHERE
        cef = '$cef'
        AND fecha = '$fecha'
    ";


    // Ejecutar la consulta
    $result = fetch_data($query, $mysqli);

    if (count($result) > 0) {
        echo json_encode(["success" => 1, "data" => $result]);
    } else {
        echo json_encode(["success" => 0, "error" => "No se encontraron datos para esa fecha y CEF"]);
    }

    // Cerrar la conexión a SQL Server
    mssql_close($mysqli);
}elseif ($tipo == 'reporte_importe_fac_global') {
    // Validar los parámetros
    if (!isset($data['cef']) || !isset($data['fecha'])) {
        echo json_encode(["success" => 0, "error" => "Parámetros faltantes: cef o fecha"]);
        exit;
    }

    // Asignar los valores enviados por el frontend
    $cef = $data['cef'];
    $fecha = $data['fecha'];

    // Ejecutar la consulta para obtener el reporte Importe Fac Global
    $query = "
        SELECT
            [SERIE] AS cef,
            [Fecha_vta] AS 'fecha_vta',
            [Fecha_factura] AS 'fecha_factura',
            [numero_comprobante] AS 'numero_comprobante',
            [REFID],
            [ESTATUS] AS 'estatus',
            CAST([SUBTOTAL] AS decimal(12, 2)) AS 'sub_total',
            [DESCUENTO] AS 'descuento',
            CAST([TOTAL] AS decimal(12, 2)) AS 'importe_total',
            [Folio_Global_Si_existe] AS 'folio_factura',
            [uuid_Global_Si_ existe] AS 'uuid_global',
            [fecha_expedición_Factura_Global] AS 'fecha_expedicion',
            [Periodicidad_Global] AS 'periodicidad',
            [Mes_Global] AS 'mes_global',
            [Año_Global] AS 'año_global'
        FROM [COINTECH_DB].[dbo].[Tickets_cs_facturacion]
        WHERE serie = '$cef'
        AND Fecha_vta BETWEEN '$fecha' AND '$fecha'
        ORDER BY [SERIE], [Fecha_vta], [Fecha_factura]
    ";

    $result = fetch_data($query, $mysqli);
    echo json_encode(["success" => 1, "data" => $result]);
}




// Cerrar la conexión a SQL Server
mssql_close($mysqli);
