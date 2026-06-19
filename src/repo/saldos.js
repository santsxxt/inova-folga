// Saldos por funcionário, derivados da escala (escala_dia). Nada de tabela nova.
// férias: dias com turno 'ferias' no ano (direito padrão 30) · folgas: turno 'folga' no mês
// faltas: turno 'falta' no ano · domingos: dias de domingo trabalhados (não folga/férias/falta) no ano

export const DIAS_FERIAS = 30;

export function saldos(db, { ano, mes }) {
  const anoIni = `${ano}-01-01`, anoFim = `${ano}-12-31`;
  const mm = String(mes).padStart(2, '0');
  const mesIni = `${ano}-${mm}-01`, mesFim = `${ano}-${mm}-31`;
  const rows = db.prepare(`
    SELECT f.id, f.nome, s.nome AS setor,
      SUM(CASE WHEN e.turno='ferias' AND e.data BETWEEN @anoIni AND @anoFim THEN 1 ELSE 0 END) AS ferias_tirados,
      SUM(CASE WHEN e.turno='folga'  AND e.data BETWEEN @mesIni AND @mesFim THEN 1 ELSE 0 END) AS folgas_mes,
      SUM(CASE WHEN e.turno='falta'  AND e.data BETWEEN @anoIni AND @anoFim THEN 1 ELSE 0 END) AS faltas_ano,
      SUM(CASE WHEN strftime('%w', e.data)='0' AND e.turno NOT IN ('folga','ferias','falta')
               AND e.data BETWEEN @anoIni AND @anoFim THEN 1 ELSE 0 END) AS domingos
    FROM funcionarios f
    LEFT JOIN setores s ON s.id = f.setor_id
    LEFT JOIN escala_dia e ON e.funcionario_id = f.id
    WHERE f.ativo = 1
    GROUP BY f.id
    ORDER BY s.ordem, f.nome
  `).all({ anoIni, anoFim, mesIni, mesFim });
  return rows.map((r) => ({
    ...r,
    ferias_tirados: r.ferias_tirados || 0,
    ferias_faltam: Math.max(0, DIAS_FERIAS - (r.ferias_tirados || 0)),
    folgas_mes: r.folgas_mes || 0,
    faltas_ano: r.faltas_ano || 0,
    domingos: r.domingos || 0,
  }));
}
