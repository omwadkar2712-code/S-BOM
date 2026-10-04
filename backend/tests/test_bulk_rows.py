"""Bulk scan row rules: duplicate projects are skipped, invalid rows do not stop the file."""

from app.sources import parse_bulk

HEADER = "project_name,application_name,version,repository_url,branch,authentication_reference,scan_type\n"


def _parse(body: str):
    return parse_bulk("projects.csv", (HEADER + body).encode(), 1024 * 1024)


def test_first_project_is_kept_and_duplicate_is_reported():
    rows, errors = _parse(
        "Express,express,1.0,https://github.com/expressjs/express,master,,GITHUB\n"
        "Express again,express,2.0,https://github.com/ExpressJS/express.git,master,,GITHUB\n"
        "Flask,flask,3.0,https://github.com/pallets/flask,main,,GITHUB\n"
    )
    assert [row["project_name"] for row in rows] == ["Express", "Express again", "Flask"]
    assert rows[0]["repository_url"] == "https://github.com/expressjs/express"
    assert [err["code"] for err in errors] == ["DUPLICATE_PROJECT"]
    assert errors[0]["row"] == 3
    assert "row 2" in errors[0]["message"]


def test_same_name_with_a_different_branch_is_not_a_duplicate():
    _rows, errors = _parse(
        "Api,api,1.0,https://github.com/acme/api,main,,GITHUB\n"
        "Api,api,1.0,https://github.com/acme/api,release,,GITHUB\n"
    )
    assert errors == []


def test_invalid_row_does_not_consume_the_project_or_reject_the_file():
    rows, errors = _parse(
        ",,1.0,not-a-url,, ,LOCAL\n"
        "\n"
        "Api,api,1.0,https://github.com/acme/api,main,,GITHUB\n"
    )
    assert len(rows) == 2
    assert {err["code"] for err in errors} == {
        "MISSING_PROJECT_NAME",
        "MISSING_APPLICATION_NAME",
        "INVALID_GITHUB_URL",
        "UNSUPPORTED_SCAN_TYPE",
    }
    assert all(err["row"] == 2 for err in errors)
    assert rows[1]["project_name"] == "Api"


def test_missing_column_rejects_the_file():
    try:
        parse_bulk("projects.csv", b"name,repository_url\nApi,https://github.com/acme/api\n", 1024)
    except ValueError as exc:
        assert "project_name" in str(exc)
    else:
        raise AssertionError("expected missing column")
