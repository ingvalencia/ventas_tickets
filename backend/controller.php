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

    // Modificar el valor de 'sigla' cuando sea 'MIM'
    foreach ($locales as &$local) {  // Usamos referencia (&) para modificar el arreglo directamente
        if ($local['sigla'] === 'MIM') {
            $local['sigla'] = 'PBMIM';
        }
    }

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
        (ISNULL(vt.[venta], 0) - ISNULL(vt.[ventaWeb], 0)) AS vtas_real,  
        CAST(ISNULL(tm.impvta, 0) AS decimal(12, 2)) AS 'imp_global', 
        CAST(ISNULL((ISNULL(vt.[venta], 0) - ISNULL(vt.[ventaWeb], 0)) - ISNULL(tm.impvta, 0), 0) AS decimal(12, 2)) AS Diferencia 
        FROM [192.168.0.59].[GrupoDiniz].[dbo].[rtv_ventas] vt
        LEFT JOIN @tabvtas tm 
            ON tm.cef = vt.cef COLLATE Modern_Spanish_CI_AS 
            AND tm.fec = vt.fecha
        WHERE vt.fecha BETWEEN '$feci' AND '$fecf' 
        AND vt.cef LIKE '$cef'
        ORDER BY vt.[cef], vt.[fecha];
    ";


    //print_r();exit($query);
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
}elseif ($tipo == 'reporte_tickets_duplicados') {
    $cef = $data['cef'];
    $fecha = $data['fecha'];

    $query = "
        SELECT t0.[clocal] Cef
              ,t0.[fecha] 'Fecha Venta'
              ,t0.[numero_comprobante] 'Numero Comprobante Ticket'
              ,t0.[importe] 'Imp. Venta'
              ,'Ticket duplicado con Otra fecha' 'Observaciones'
              ,t1.FechaTicket 'Fecha Ticket Anterior'
              ,t1.Importe 'Imp. Anterior'
          FROM [GSSAP2010].[dbo].[FA_POS] t0
          LEFT JOIN [GSSAP2010].[dbo].[ADM_LogTickets] t1 
                ON t1.Numero_Comprobante = t0.numero_comprobante 
                AND t1.Clocal = t0.clocal
          WHERE t0.clocal = '$cef' 
                AND t0.fecha = '$fecha'
                AND t0.numero_comprobante > 0 
                AND t1.FechaTicket <> t0.fecha
          ORDER BY t0.[numero_comprobante], t0.[fecha]";

    $result = fetch_data($query, $mysqli);
    echo json_encode(["success" => 1, "data" => $result]);
}elseif ($tipo == 'consultar_carga_global') {
    // Validar los parámetros recibidos desde el frontend
    if (!isset($data['cef']) || !isset($data['feci']) || !isset($data['fecf']) || !isset($data['page']) || !isset($data['pageSize'])) {
        echo json_encode(["success" => 0, "error" => "Parámetros faltantes: cef, feci, fecf, page o pageSize"]);
        exit;
    }

    // Asignar los valores enviados por el frontend
    $cef = $data['cef'];
    $fechaInicial = $data['feci'];
    $fechaFinal = $data['fecf'];
    $page = (int)$data['page'];
    $pageSize = (int)$data['pageSize'];
    $offset = ($page - 1) * $pageSize;

    // Conectar al servidor SQL Server
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

    // Construir la consulta base con el filtro de fechas
    $baseQuery = "FROM [COINTECH_DB].[dbo].[Tickets_cs_facturacion]
                  WHERE Fecha_vta BETWEEN '$fechaInicial' AND '$fechaFinal'";

    // Agregar el filtro de SERIE solo si $cef no es "TODOS"
    if ($cef !== "TODOS") {
        $baseQuery .= " AND SERIE = '$cef'";
    }

    // Consulta para obtener el número total de registros que cumplen los criterios
    $countQuery = "SELECT COUNT(*) AS total " . $baseQuery;
    $countResult = fetch_data($countQuery, $mysqli);
    if (!$countResult) {
        echo json_encode(["success" => 0, "error" => "Error al obtener el total de registros"]);
        exit;
    }
    $total = $countResult[0]['total'];

    // Consulta principal para obtener los datos paginados y ordenados
    $query = "SELECT *
              $baseQuery
              ORDER BY SERIE, Fecha_vta
              OFFSET $offset ROWS FETCH NEXT $pageSize ROWS ONLY";
              
    $result = fetch_data($query, $mysqli);
    if ($result === false) {
        echo json_encode(["success" => 0, "error" => "Error al ejecutar la consulta"]);
        exit;
    }

    // Enviar los datos paginados junto con el total de registros
    echo json_encode([
        "success" => 1,
        "data" => $result,
        "total" => $total // Enviar el total de registros para cálculo de paginación en frontend
    ]);

    // Cerrar la conexión a SQL Server
    mssql_close($mysqli);
}elseif ($tipo == 'descargar_carga_global') {
    // Validar los parámetros recibidos desde el frontend
    if (!isset($data['cef']) || !isset($data['feci']) || !isset($data['fecf']) || !isset($data['start']) || !isset($data['limit'])) {
        echo json_encode(["success" => 0, "error" => "Parámetros faltantes: cef, feci, fecf, start o limit"]);
        exit;
    }

    // Asignar los valores enviados por el frontend
    $cef = $data['cef'];
    $fechaInicial = $data['feci'];
    $fechaFinal = $data['fecf'];
    $start = (int)$data['start'];
    $limit = (int)$data['limit'];

    // Consulta para obtener los datos en un rango
    $query = "SELECT *
              FROM [COINTECH_DB].[dbo].[Tickets_cs_facturacion]
              WHERE Fecha_vta BETWEEN '$fechaInicial' AND '$fechaFinal'
              " . ($cef !== "TODOS" ? " AND SERIE = '$cef'" : "") . "
              ORDER BY Fecha_vta
              OFFSET $start ROWS FETCH NEXT $limit ROWS ONLY";
    $result = fetch_data($query, $mysqli);

    if ($result === false) {
        echo json_encode(["success" => 0, "error" => "Error al ejecutar la consulta para la descarga"]);
        exit;
    }

    // Enviar los datos en partes
    echo json_encode([
        "success" => 1,
        "data" => $result
    ]);

    mssql_close($mysqli);
}elseif ($tipo == 'consultar_cancelaciones') {
    // Validar los parámetros recibidos desde el frontend
    if (!isset($data['cef']) || !isset($data['feci']) || !isset($data['fecf']) || !isset($data['page']) || !isset($data['pageSize'])) {
        echo json_encode(["success" => 0, "error" => "Parámetros faltantes: cef, feci, fecf, page o pageSize"]);
        exit;
    }

    // Asignar los valores enviados por el frontend
    $cef = $data['cef'];
    $fechaInicial = $data['feci'];
    $fechaFinal = $data['fecf'];
    $page = (int)$data['page'];
    $pageSize = (int)$data['pageSize'];
    $offset = ($page - 1) * $pageSize;

    // Conectar al servidor SQL Server
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

    // Construir la consulta base con el filtro de fechas
    $baseQuery = "FROM [COINTECH_DB_PRUEBAS].[dbo].[tickets_db_cointech_cef]
                  WHERE fecha BETWEEN '$fechaInicial' AND '$fechaFinal'
                  AND (CAST(IMPORTE AS DECIMAL(12, 2)) < 0 OR CAST(NUMERO_COMPROBANTE AS INT) = 0)";

    // Agregar el filtro de CEF solo si no es "TODOS"
    if ($cef !== "TODOS") {
        $baseQuery .= " AND CEF = '$cef'";
    }

    // Consulta para obtener el número total de registros que cumplen los criterios
    $countQuery = "SELECT COUNT(*) AS total " . $baseQuery;
    $countResult = fetch_data($countQuery, $mysqli);
    if (!$countResult) {
        echo json_encode(["success" => 0, "error" => "Error al obtener el total de registros"]);
        exit;
    }
    $total = $countResult[0]['total'];

    // Consulta principal para obtener los datos paginados y ordenados
    $query = "SELECT CEF, FECHA, ID_TRANSACCION, FORMA_PAGO, NUMERO_TERMINAL, TIPO, NUMERO_COMPROBANTE, 
                     CAST(IMPORTE AS DECIMAL(12, 2)) AS Importe
              $baseQuery
              ORDER BY CEF, FECHA
              OFFSET $offset ROWS FETCH NEXT $pageSize ROWS ONLY";

    $result = fetch_data($query, $mysqli);
    if ($result === false) {
        echo json_encode(["success" => 0, "error" => "Error al ejecutar la consulta"]);
        exit;
    }

    // Enviar los datos paginados junto con el total de registros
    echo json_encode([
        "success" => 1,
        "data" => $result,
        "total" => $total // Enviar el total de registros para cálculo de paginación en frontend
    ]);

    // Cerrar la conexión a SQL Server
    mssql_close($mysqli);
}

//INICIO
elseif (isset($_POST['tipo']) && $_POST['tipo'] === 'subir_reporte_ticket_fragmento') {
    $nombreArchivo = $_FILES['archivo']['name'];
    $rutaDestino = '/var/www/html/diniz/servicios/services/ventas-tickets/excel/' . $nombreArchivo;

    // Mensaje de depuración inicial
    $debug_message = "Inicio del procesamiento de fragmento\n";

    if (!isset($_FILES['archivo']) || $_FILES['archivo']['error'] !== UPLOAD_ERR_OK) {
        echo json_encode(["success" => 0, "error" => "No se recibió el fragmento o ocurrió un error en la subida", "debug" => $debug_message]);
        exit;
    }

    // Mover el archivo al destino especificado
    if (!move_uploaded_file($_FILES['archivo']['tmp_name'], $rutaDestino)) {
        echo json_encode(["success" => 0, "error" => "Error al mover el archivo al destino", "debug" => $debug_message]);
        exit;
    }

    $debug_message .= "Archivo movido a la ruta $rutaDestino\n";

    // Verificación del formato JSON
    if (pathinfo($nombreArchivo, PATHINFO_EXTENSION) !== 'json') {
        echo json_encode(["success" => 0, "error" => "El fragmento debe estar en formato JSON", "debug" => $debug_message]);
        exit;
    }

    // Leer el archivo en la nueva ubicación
    $data = file_get_contents($rutaDestino);
    $registros = json_decode($data, true);

    if ($registros === null) {
        echo json_encode(["success" => 0, "error" => "Error al decodificar el fragmento JSON", "debug" => $debug_message]);
        exit;
    }

    $debug_message .= "Archivo JSON decodificado\n";

    // Variables para almacenar las fechas máxima y mínima
    $fechasVenta = [];

    // Recorrer los registros para extraer y convertir las fechas
    foreach ($registros as $datos) {
        $fechaVenta = DateTime::createFromFormat('Y-m-d H:i:s', $datos['FCH/HR VENTA']);
        
        if ($fechaVenta !== false) {
            $fechasVenta[] = $fechaVenta;
        }
    }

    // Calcular y almacenar las fechas mínima y máxima si existen fechas válidas
    if (!empty($fechasVenta)) {
        $fechaMinima = min($fechasVenta)->format('Y-m-d H:i:s');
        $fechaMaxima = max($fechasVenta)->format('Y-m-d H:i:s');
        $debug_message .= "Fechas calculadas exitosamente\n";
    } else {
        echo json_encode([
            "success" => 0,
            "error" => "No se encontraron fechas válidas en el archivo",
            "debug" => $debug_message
        ]);
        exit;
    }

    // Verificar si existen registros dentro del rango de fechas
    $queryCount = "SELECT COUNT(*) AS count FROM COINTECH_DB.dbo.Tickets_cs_facturacion 
                   WHERE CAST(Fecha_vta AS DATE) BETWEEN '$fechaMinima' AND '$fechaMaxima'";
    $resultCount = mssql_query($queryCount);
    $countRow = mssql_fetch_assoc($resultCount);
    $count = $countRow['count'];

    if ($count > 0) {
        // Si existen registros, eliminarlos antes de insertar
        $queryDelete = "DELETE FROM COINTECH_DB.dbo.Tickets_cs_facturacion 
                        WHERE CAST(Fecha_vta AS DATE) BETWEEN '$fechaMinima' AND '$fechaMaxima'";
        mssql_query($queryDelete);
        $debug_message .= "Registros eliminados en el rango de fechas $fechaMinima a $fechaMaxima\n";
    } else {
        $debug_message .= "No se encontraron registros previos en el rango de fechas $fechaMinima a $fechaMaxima\n";
    }

    // Procesar e insertar los registros en la base de datos
    $procesados = 0;
    $errores = 0;
    $loteRegistros = [];
    $registrosPorLote = 1000;

    foreach ($registros as $datos) {
        $datos['Fecha_vta'] = date('Y-m-d', strtotime($datos['FCH/HR VENTA']));
        $datos['Fecha_factura'] = date('Y-m-d', strtotime($datos['FECHA expedición Factura Global (Si existe)']));
        $datos['numero_comprobante'] = (strlen($datos['SERIE']) === 3)
            ? substr($datos['REFID'], 4, 10)
            : substr($datos['REFID'], 6, 7);

        $loteRegistros[] = $datos;

        if (count($loteRegistros) === $registrosPorLote) {
            if (!insertarLote($loteRegistros)) {
                $errores += count($loteRegistros);
            } else {
                $procesados += count($loteRegistros);
            }
            $loteRegistros = [];
        }
    }

    if (count($loteRegistros) > 0) {
        if (!insertarLote($loteRegistros)) {
            $errores += count($loteRegistros);
        } else {
            $procesados += count($loteRegistros);
        }
    }

    // Eliminar el archivo después de la inserción
    if (file_exists($rutaDestino)) {
        unlink($rutaDestino);
        $debug_message .= "Archivo $rutaDestino eliminado después de la inserción\n";
    }

    // Respuesta final con todos los datos
    echo json_encode([
        "success" => 1,
        "fecha_minima" => $fechaMinima,
        "fecha_maxima" => $fechaMaxima,
        "processed" => $procesados,
        "errors" => $errores,
        "message" => "Fragmento procesado y archivo eliminado",
        "debug" => $debug_message
    ]);
    exit;
}

// Función para insertar los registros en lotes
function insertarLote($loteRegistros) {
    global $debug_message;
    $debug_message .= "Iniciando inserción de lote\n";
    $valores = [];
    foreach ($loteRegistros as $datos) {
        $valores[] = "(
            '" . $datos['FCH/HR VIGENCIA'] . "',
            '" . $datos['FCH/HR VENTA'] . "',
            '" . $datos['FCH/HR RECEPCION'] . "',
            '" . $datos['REFID'] . "',
            '" . $datos['ESTATUS'] . "',
            '" . $datos['SERIE'] . "',
            '" . $datos['SUBTOTAL'] . "',
            '" . $datos['DESCUENTO'] . "',
            '" . $datos['IVA'] . "',
            '" . $datos['IEPS TRASLADADO 0.06'] . "',
            '" . $datos['IEPS TRASLADADO 0.08'] . "',
            '" . $datos['IEPS TRASLADADO 0.265'] . "',
            '" . $datos['IEPS TRASLADADO 0.53'] . "',
            '" . $datos['OTRO IEPS'] . "',
            '" . $datos['TOTAL'] . "',
            '" . $datos['Folio Factura Ingreso'] . "',
            '" . $datos['UUID Factura Ingreso'] . "',
            '" . $datos['FECHA expedición Factura Ingreso'] . "',
            '" . $datos['Folio Factura Egreso (Si existe)'] . "',
            '" . $datos['UUID Factura Egreso (Si existe)'] . "',
            '" . $datos['FECHA expedición Factura Egreso (Si existe)'] . "',
            '" . $datos['Folio Global (Si existe)'] . "',
            '" . $datos['UUID Global (Si existe)'] . "',
            '" . $datos['FECHA expedición Factura Global (Si existe)'] . "',
            '" . $datos['Periodicidad Global (Si existe)'] . "',
            '" . $datos['Mes Global (Si existe)'] . "',
            '" . $datos['Año Global (Si existe)'] . "',
            CAST('" . $datos['Fecha_vta'] . "' AS DATE),
            CAST('" . $datos['Fecha_factura'] . "' AS DATE),
            CAST('" . $datos['numero_comprobante'] . "' AS INT)
        )";
    }
    $query = "INSERT INTO COINTECH_DB.dbo.Tickets_cs_facturacion
        ([fecha_hora_vigencia], [fecha_hora_vta], [fecha_recepcion], [REFID], [ESTATUS], [SERIE], [SUBTOTAL], [DESCUENTO], [IVA], 
        [ieps_trasladp_6], [ieps_traslado_8], [ieps_tralado_0 265], [ieps_tralado_0 53], [otros_ieps], [TOTAL], [Folio_Fctura_Ingreso], 
        [UUI_factura_Ingreso], [fecha_expedición_Factura_Ingreso], [Folio_Factura_egreso_Si_existe], [uuid_Factura_Egreso_Si_existe], 
        [fecha_expedición_Factura_Egreso_Si_existe], [Folio_Global_Si_existe], [uuid_Global_Si_ existe], 
        [fecha_expedición_Factura_Global], [Periodicidad_Global], [Mes_Global], [Año_Global], 
        [Fecha_vta], [Fecha_factura], [numero_comprobante])
        VALUES " . implode(", ", $valores);

    $result = mssql_query($query);
    $debug_message .= "Resultado de la inserción: " . ($result ? "Éxito\n" : "Fallo\n");
    return $result;
}
//FIN






// Cerrar la conexión a SQL Server
mssql_close($mysqli);
