import {
  Alert,
  App,
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Switch,
  Tooltip,
} from "antd";
import React from "react";
import { Meteor } from "meteor/meteor";
import { DrawerContext } from "../app/App";

export default function RegistrationForm({ setOpen }) {
  const [form] = Form.useForm();
  const { message, notification } = App.useApp();
  const [loading, setLoading] = React.useState(false);
  const [disableSubmit, setDisableSubmit] = React.useState(false);
  const [nameError, setNameError] = React.useState(undefined);
  const [idError, setIdError] = React.useState(undefined);
  const drawer = React.useContext(DrawerContext);
  const model = React.useMemo(() => {
    return drawer.drawerModel || {};
  });
  React.useEffect(() => {
    if (Object.keys(model).length > 0) {
      form.setFieldsValue(model);
    } else {
      form.setFieldsValue({
        name: "",
        id: null,
        age: null,
        discoveryType: null,
        rulesReadAndAccepted: false,
        description: "",
      });
    }
  }, [model]);

  function validateName() {
    const value = form.getFieldValue("name");
    setNameError("validating");
    Meteor.callAsync("registrations.validateName", value, model?._id)
      .then((result) => {
        setNameError(result ? "success" : "error");
        setDisableSubmit(!result);
      })
      .catch((error) => {
        setNameError("warning");
      });
  }

  function validateId() {
    const value = form.getFieldValue("id");
    setIdError("validating");
    Meteor.callAsync("registrations.validateId", value, model?._id)
      .then((result) => {
        setIdError(result ? "success" : "error");
        setDisableSubmit(!result);
      })
      .catch((error) => {
        setIdError("warning");
      });
  }

  function handleSubmit(values) {
    setLoading(true);
    const { name, id, age, discoveryType, rulesReadAndAccepted, description } =
      values;
    const args = [
      ...(model?._id ? [model._id] : []),
      { name, id, age, discoveryType, rulesReadAndAccepted, description },
    ];
    Meteor.callAsync(
      Meteor.user() && model?._id
        ? "registrations.update"
        : "registrations.insert",
      ...args
    )
      .then(() => {
        setOpen(false);
        form.resetFields();
        message.success("Registration successful");
      })
      .catch((error) => {
        console.error(error);
        notification.error({
          message: error.error,
          description: error.message,
        });
      })
      .finally(() => setLoading(false));
  }

  function handleValuesChange(changedValues, values) {
    if ("name" in values) {
      validateName();
    }
    if ("id" in values) {
      validateId();
    }
    if (
      "rulesReadAndAccepted" in changedValues &&
      "rulesReadAndAccepted" in values
    ) {
      setDisableSubmit(!values.rulesReadAndAccepted);
    }
  }

  React.useEffect(() => {
    handleValuesChange(model ?? {}, model ?? {});
  }, [model]);

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      onValuesChange={handleValuesChange}
      disabled={loading}
    >
      {(nameError === "error" || idError === "error") && (
        <Alert
          className="alert"
          type="error"
          description={
            <Row gutter={[16, 16]}>
              {nameError === "error" && (
                <Col span={24}>Name already in use</Col>
              )}
              {idError === "error" && <Col span={24}>ID already in use</Col>}
            </Row>
          }
        />
      )}
      <Form.Item
        name="name"
        label="Desired Name"
        rules={[{ required: true, type: "string" }]}
        status={nameError}
        required
      >
        <Input placeholder="Enter desired name" />
      </Form.Item>
      <Form.Item
        name="id"
        label="Desired ID"
        rules={[
          { required: true, type: "number" },
          { min: 1000, max: 9999, type: "number" },
        ]}
        status={idError}
        required
      >
        <InputNumber
          min={1000}
          max={9999}
          step={1}
          placeholder="Enter desired ID"
        />
      </Form.Item>
      <Form.Item
        name="age"
        label="Age"
        rules={[
          { required: true, type: "number" },
          { type: "number", min: 16 },
        ]}
        required
      >
        <InputNumber min={16} step={1} placeholder="Enter age" />
      </Form.Item>
      <Form.Item name="discoveryType" label="Discovery Type">
        <Select placeholder="Select discovery type" options={[]} />
      </Form.Item>
      <Form.Item
        name="rulesReadAndAccepted"
        label="I read the rules and accept them"
        rules={[{ required: true, type: "boolean" }]}
        required
      >
        <Switch />
      </Form.Item>
      {Meteor.user() && (
        <Form.Item
          name="description"
          label="Description"
          rules={[{ type: "string" }]}
        >
          <Input.TextArea placeholder="Enter description" />
        </Form.Item>
      )}
      <Row gutter={[16, 16]} align="middle" justify="end">
        <Col>
          <Button onClick={() => setOpen(false)} danger>
            Cancel
          </Button>
        </Col>
        <Col>
          <Tooltip
            title={disableSubmit ? "Please read and accept the rules" : ""}
          >
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              disabled={disableSubmit}
            >
              Submit
            </Button>
          </Tooltip>
        </Col>
      </Row>
    </Form>
  );
}
