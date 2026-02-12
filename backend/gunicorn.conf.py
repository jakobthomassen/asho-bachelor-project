accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = (
    '%(h)s %(l)s %(u)s "%(r)s" %(s)s %(b)s '
    '"%(f)s" "%(a)s" '
    'ua="%({User-Agent}i)s" x_monitor_source="%({X-Monitor-Source}i)s"'
)
